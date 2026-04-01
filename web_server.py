"""
GATeR Web Server
Flask web server with GitHub OAuth integration and incremental analysis
"""

import os
import logging
import json
import time
import requests
import numpy as np
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, jsonify, session
from flask_cors import CORS
from requests_oauthlib import OAuth2Session
from dotenv import load_dotenv

# Allow insecure transport for development (only for OAuth)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# Import GATeR components
from gater import GATeRAnalyzer
from src.incremental_manager import IncrementalAnalysisManager
from src.vector_storage import LanceManager, VectorIndexer, EmbeddingSync
from src.vector_storage.step6_vector_storage import Step6VectorStorage
from src.vector_storage.lightweight_vector_storage import LightweightVectorStorage

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('workspace/logs/web_server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('gater.web_server')

import math

def convert_numpy_types(obj):
    """Convert numpy types to Python native types for JSON serialization.
    Also handles Infinity and NaN values which are not valid JSON."""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        val = float(obj)
        # Handle Infinity and NaN - not valid in JSON
        if math.isinf(val):
            return None  # or use a large number like 999999
        elif math.isnan(val):
            return None
        return val
    elif isinstance(obj, float):
        # Handle Python float Infinity and NaN
        if math.isinf(obj):
            return None  # or use a large number like 999999
        elif math.isnan(obj):
            return None
        return obj
    elif isinstance(obj, np.ndarray):
        return [convert_numpy_types(item) for item in obj.tolist()]
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    elif isinstance(obj, str):
        # Handle strings properly - just return as is
        return obj
    else:
        return obj

# Flask app configuration
app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')
CORS(app)

# GitHub OAuth configuration
GITHUB_CLIENT_ID = os.getenv('GITHUB_CLIENT_ID')
GITHUB_CLIENT_SECRET = os.getenv('GITHUB_CLIENT_SECRET')
GITHUB_OAUTH_REDIRECT_URI = os.getenv('GITHUB_OAUTH_REDIRECT_URI', 'http://127.0.0.1:5000/auth/callback')

if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
    logger.error("GitHub OAuth credentials not found in environment variables")
    raise ValueError("GitHub OAuth credentials are required")

# GitHub OAuth URLs
GITHUB_AUTHORIZATION_BASE_URL = 'https://github.com/login/oauth/authorize'
GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'

# Initialize GATeR
gater = GATeRAnalyzer()
incremental_manager = IncrementalAnalysisManager(gater)

# Initialize Vector Storage (Step 6) with fallback
step6_vector_storage = None
try:
    logger.info("Attempting to initialize standard vector storage...")
    lance_manager = LanceManager(db_path=os.getenv('LANCEDB_PATH', 'workspace/lancedb'))
    vector_indexer = VectorIndexer(lance_manager)
    embedding_sync = EmbeddingSync(lance_manager, vector_indexer)
    step6_vector_storage = Step6VectorStorage(db_path=os.getenv('LANCEDB_PATH', 'workspace/lancedb'))
    logger.info("SUCCESS: Vector storage initialized successfully")
except Exception as e:
    logger.warning(f"Standard vector storage failed: {e}")
    logger.info("🔄 Trying lightweight vector storage as fallback...")
    try:
        step6_vector_storage = LightweightVectorStorage(db_path=os.getenv('LANCEDB_PATH', 'workspace/lancedb'))
        logger.info("SUCCESS: Lightweight vector storage initialized successfully")
    except Exception as e2:
        logger.error(f"❌ Both vector storage methods failed: {e2}")
        lance_manager = None
        vector_indexer = None
        embedding_sync = None
        step6_vector_storage = None

# Global storage for vector search results
vector_search_results = {}

# Add cleanup handler
import atexit
def cleanup_gater():
    """Cleanup GATeR resources on exit"""
    try:
        if gater and gater.kg_manager and gater.kg_manager.kuzu_manager:
            gater.kg_manager.kuzu_manager.disconnect()
        if lance_manager:
            lance_manager.close()
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")

atexit.register(cleanup_gater)

# Global error handlers to ensure JSON responses
@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors with JSON response"""
    logger.error(f"Internal Server Error: {error}")
    return jsonify({
        'error': 'Internal Server Error',
        'message': str(error) if app.debug else 'An unexpected error occurred'
    }), 500

@app.errorhandler(404)
def not_found_error(error):
    """Handle 404 errors with JSON response"""
    return jsonify({
        'error': 'Not Found',
        'message': 'The requested resource was not found'
    }), 404

@app.errorhandler(Exception)
def handle_exception(error):
    """Handle all unhandled exceptions with JSON response"""
    logger.error(f"Unhandled exception: {error}", exc_info=True)
    return jsonify({
        'error': 'Internal Server Error',
        'message': str(error) if app.debug else 'An unexpected error occurred'
    }), 500

# Progress tracking functions
def update_progress(step, step_name, step_description, details=None):
    """Update analysis progress"""
    import time
    app_state['progress'].update({
        'step': step,
        'step_name': step_name,
        'step_description': step_description,
        'details': details or {},
        'current_step_start': time.time()
    })
    if step == 1:
        app_state['progress']['start_time'] = time.time()
    logger.info(f"Progress Update - Step {step}: {step_name}")

def reset_progress():
    """Reset progress tracking"""
    app_state['progress'] = {
        'step': 0,
        'step_name': '',
        'step_description': '',
        'details': {},
        'start_time': None,
        'current_step_start': None
    }

# Global state
app_state = {
    'current_repo': None,
    'analysis_status': 'idle',
    'last_analysis': None,
    'repo_status': {
        'commits_behind': 0,
        'last_check': None,
        'local_commit': None,
        'remote_commit': None,
        'up_to_date': True
    },
    'progress': {
        'step': 0,
        'step_name': '',
        'step_description': '',
        'details': {},
        'start_time': None,
        'current_step_start': None
    }
}

@app.route('/')
def index():
    """Main dashboard"""
    import json
    current_repo_json = json.dumps(app_state['current_repo']) if app_state['current_repo'] else 'null'
    repo_status_json = json.dumps(app_state['repo_status'])
    return render_template('index.html', 
                         authenticated=is_authenticated(),
                         app_state=app_state,
                         current_repo_json=current_repo_json,
                         repo_status_json=repo_status_json)

@app.route('/auth/login')
def login():
    """Initiate GitHub OAuth login"""
    github = OAuth2Session(
        GITHUB_CLIENT_ID, 
        redirect_uri=GITHUB_OAUTH_REDIRECT_URI,
        scope=['repo']  # Request repository access
    )
    authorization_url, state = github.authorization_url(GITHUB_AUTHORIZATION_BASE_URL)
    session['oauth_state'] = state
    return redirect(authorization_url)

@app.route('/auth/callback')
def auth_callback():
    """Handle GitHub OAuth callback"""
    try:
        github = OAuth2Session(
            GITHUB_CLIENT_ID,
            state=session.get('oauth_state'),
            redirect_uri=GITHUB_OAUTH_REDIRECT_URI
        )
        
        token = github.fetch_token(
            GITHUB_TOKEN_URL,
            client_secret=GITHUB_CLIENT_SECRET,
            authorization_response=request.url
        )
        
        # Store token in session
        session['oauth_token'] = token
        
        # Get user info
        user_response = github.get('https://api.github.com/user')
        if user_response.status_code == 200:
            session['user'] = user_response.json()
            logger.info(f"User {session['user']['login']} authenticated successfully")
        
        return redirect(url_for('index'))
        
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        return render_template('error.html', error="Authentication failed"), 400

@app.route('/auth/logout')
def logout():
    """Logout user"""
    session.clear()
    return redirect(url_for('index'))

@app.route('/auth/dev-login')
def dev_login():
    """Development login for testing (no OAuth required)"""
    if os.getenv('DEV_MODE', 'false').lower() == 'true':
        # Set up a development session
        session['oauth_token'] = {'access_token': 'dev_token'}
        session['user'] = {
            'login': 'dev_user',
            'name': 'Development User',
            'id': 12345
        }
        logger.info("Development user authenticated")
        return redirect(url_for('index'))
    else:
        return jsonify({'error': 'Development mode not enabled'}), 403

@app.route('/auth/sync', methods=['POST'])
def auth_sync():
    """Sync authentication from external frontend (Next.js)
    
    Accepts a GitHub access token and user info, establishes a Flask session.
    This allows the Next.js frontend to authenticate via NextAuth and share
    the auth state with Flask backend.
    """
    try:
        data = request.get_json()
        github_token = data.get('github_token')
        user = data.get('user')
        
        if not github_token:
            return jsonify({'error': 'GitHub token is required'}), 400
        
        # Store token in session
        session['oauth_token'] = {'access_token': github_token}
        
        # If user info provided, use it; otherwise fetch from GitHub
        if user:
            session['user'] = {
                'login': user.get('name') or user.get('email', '').split('@')[0] or 'user',
                'name': user.get('name') or 'GitHub User',
                'email': user.get('email'),
                'id': user.get('id')
            }
        else:
            # Fetch user info from GitHub
            import requests
            headers = {'Authorization': f'Bearer {github_token}'}
            user_response = requests.get('https://api.github.com/user', headers=headers)
            if user_response.status_code == 200:
                session['user'] = user_response.json()
            else:
                session['user'] = {'login': 'api_user', 'name': 'API User'}
        
        logger.info(f"Session synced for user: {session['user'].get('login', 'unknown')}")
        return jsonify({
            'success': True, 
            'user': session['user'],
            'message': 'Session synced successfully'
        })
        
    except Exception as e:
        logger.error(f"Auth sync error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/auth/status')
def auth_status():
    """Check authentication status - useful for frontend to verify auth"""
    if is_authenticated():
        user = session.get('user', {})
        return jsonify({
            'authenticated': True,
            'user': {
                'login': user.get('login'),
                'name': user.get('name'),
                'email': user.get('email'),
                'avatar_url': user.get('avatar_url')
            }
        })
    return jsonify({'authenticated': False})

@app.route('/repo/add', methods=['POST'])
def add_repository():
    """Add a repository for analysis"""
    if not is_authenticated():
        return jsonify({'error': 'Authentication required'}), 401
    
    try:
        data = request.get_json()
        repo_url = data.get('repo_url', '').strip()
        
        if not repo_url:
            return jsonify({'error': 'Repository URL is required'}), 400
        
        # Parse repository owner/name
        repo_owner, repo_name = parse_repo_url(repo_url)
        if not repo_owner or not repo_name:
            return jsonify({'error': 'Invalid repository URL format'}), 400
        
        # Set current repository
        app_state['current_repo'] = {
            'owner': repo_owner,
            'name': repo_name,
            'url': repo_url,
            'added_at': datetime.now().isoformat()
        }
        
        # Check if repository already exists locally
        repo_path = gater.get_repo_path(f"{repo_owner}/{repo_name}")
        if os.path.exists(repo_path):
            # Get repository status
            status = incremental_manager.get_repository_status(repo_path)
            return jsonify({
                'success': True,
                'message': 'Repository found locally',
                'repo_info': app_state['current_repo'],
                'status': status
            })
        else:
            return jsonify({
                'success': True,
                'message': 'Repository added, ready for analysis',
                'repo_info': app_state['current_repo'],
                'needs_analysis': True
            })
            
    except Exception as e:
        logger.error(f"Error adding repository: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/repo/analyze', methods=['POST'])
def analyze_repository():
    """Analyze the current repository"""
    logger.info("Analysis request received")
    
    if not is_authenticated():
        logger.error("Analysis failed: Authentication required")
        return jsonify({'error': 'Authentication required'}), 401
    
    if not app_state['current_repo']:
        logger.error("Analysis failed: No repository selected")
        return jsonify({'error': 'No repository selected'}), 400
    
    try:
        logger.info(f"Starting analysis for repository: {app_state['current_repo']}")
        app_state['analysis_status'] = 'analyzing'
        reset_progress()
        
        repo_identifier = f"{app_state['current_repo']['owner']}/{app_state['current_repo']['name']}"
        
        # Set GitHub token for API access (check both Flask session and headers)
        token = get_github_token()
        if token:
            gater.set_github_token(token)
        else:
            logger.warning("No GitHub token available - GitHub artifacts will be skipped")
        
        # Get skip_github_artifacts flag from request (default False for complete analysis)
        try:
            data = request.get_json() or {}
        except Exception:
            # Fallback if no JSON provided or wrong content type
            data = {}
        skip_github_artifacts = data.get('skip_github_artifacts', False)
        
        # Step 1: Repository Added
        update_progress(1, "Repository Added", "Repository URL validated and added to queue")
        
        # Perform analysis with progress tracking
        results = gater.analyze_repository_with_progress(
            repo_identifier, 
            incremental=False,
            skip_github_artifacts=skip_github_artifacts,
            progress_callback=update_progress
        )
        
        # Step 6: Sync embeddings to LanceDB (automatic after analysis)
        update_progress(6, "Vector Embeddings", "Syncing entities to LanceDB for semantic search")
        try:
            if lance_manager and lance_manager.is_available() and embedding_sync:
                sync_result = embedding_sync.sync_from_knowledge_graph(
                    gater.kg_manager,
                    gater.relevance_scorer
                )
                logger.info(f"Vector sync completed: {sync_result.get('vectors_synced', 0)} vectors")
                results['vector_sync'] = sync_result
            else:
                logger.warning("LanceDB not available, skipping vector sync")
                results['vector_sync'] = {'success': False, 'error': 'LanceDB not available'}
        except Exception as sync_error:
            logger.error(f"Error syncing vectors: {sync_error}")
            results['vector_sync'] = {'success': False, 'error': str(sync_error)}
        
        app_state['analysis_status'] = 'completed'
        app_state['last_analysis'] = {
            'timestamp': datetime.now().isoformat(),
            'results': results
        }
        
        return jsonify({
            'success': True,
            'message': 'Analysis completed successfully',
            'results': results
        })
        
    except Exception as e:
        app_state['analysis_status'] = 'error'
        reset_progress()  # Reset progress on error
        logger.error(f"Error analyzing repository: {e}", exc_info=True)
        return jsonify({
            'error': str(e),
            'success': False,
            'message': f'Analysis failed: {str(e)}'
        }), 500

@app.route('/repo/analysis-status')
def analysis_status():
    """Get current analysis status for real-time updates"""
    return jsonify({
        'status': app_state['analysis_status'],
        'current_repo': app_state['current_repo'],
        'last_analysis': app_state.get('last_analysis')
    })

@app.route('/repo/progress')
def get_progress():
    """Get real-time analysis progress"""
    return jsonify({
        'progress': app_state['progress'],
        'status': app_state['analysis_status']
    })

@app.route('/repo/status')
def repository_status():
    """Get current repository status"""
    if not app_state['current_repo']:
        return jsonify({'error': 'No repository selected'}), 400
    
    try:
        repo_identifier = f"{app_state['current_repo']['owner']}/{app_state['current_repo']['name']}"
        repo_path = gater.get_repo_path(repo_identifier)
        
        # Get local repository status
        local_status = incremental_manager.get_repository_status(repo_path)
        
        # Check for remote updates if repo exists locally
        remote_status = {}
        if local_status.get('exists'):
            remote_status = incremental_manager.check_for_remote_updates(repo_path)
            
            # Update global app state with commit status
            if 'up_to_date' in remote_status:
                app_state['repo_status'].update({
                    'commits_behind': remote_status.get('commits_behind', 0),
                    'last_check': datetime.now().isoformat(),
                    'local_commit': remote_status.get('local_commit'),
                    'remote_commit': remote_status.get('remote_commit'),
                    'up_to_date': remote_status.get('up_to_date', True)
                })
        
        return jsonify({
            'repo_info': app_state['current_repo'],
            'local_status': local_status,
            'remote_status': remote_status,
            'analysis_status': app_state['analysis_status'],
            'last_analysis': app_state['last_analysis'],
            'repo_status': app_state['repo_status']
        })
        
    except Exception as e:
        logger.error(f"Error getting repository status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/repo/check-updates')
def check_updates():
    """Quick endpoint to check for updates without full status"""
    if not app_state['current_repo']:
        return jsonify({'error': 'No repository selected'}), 400
    
    try:
        repo_identifier = f"{app_state['current_repo']['owner']}/{app_state['current_repo']['name']}"
        repo_path = gater.get_repo_path(repo_identifier)
        
        # Only check if repo exists locally
        local_status = incremental_manager.get_repository_status(repo_path)
        if not local_status.get('exists'):
            return jsonify({
                'repo_exists': False,
                'message': 'Repository not found locally'
            })
        
        # Check for remote updates
        remote_status = incremental_manager.check_for_remote_updates(repo_path)
        
        # Update global state
        if 'up_to_date' in remote_status:
            app_state['repo_status'].update({
                'commits_behind': remote_status.get('commits_behind', 0),
                'last_check': datetime.now().isoformat(),
                'local_commit': remote_status.get('local_commit'),
                'remote_commit': remote_status.get('remote_commit'),
                'up_to_date': remote_status.get('up_to_date', True)
            })
        
        return jsonify({
            'repo_exists': True,
            'commits_behind': app_state['repo_status']['commits_behind'],
            'up_to_date': app_state['repo_status']['up_to_date'],
            'last_check': app_state['repo_status']['last_check'],
            'new_commits': remote_status.get('new_commits', [])
        })
        
    except Exception as e:
        logger.error(f"Error checking for updates: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/repo/pull', methods=['POST'])
def pull_changes():
    """Pull latest changes and perform incremental analysis"""
    if not is_authenticated():
        return jsonify({'error': 'Authentication required'}), 401
    
    if not app_state['current_repo']:
        return jsonify({'error': 'No repository selected'}), 400
    
    try:
        app_state['analysis_status'] = 'updating'
        
        repo_identifier = f"{app_state['current_repo']['owner']}/{app_state['current_repo']['name']}"
        repo_path = gater.get_repo_path(repo_identifier)
        
        # Pull changes and analyze
        results = incremental_manager.pull_and_analyze_changes(repo_path)
        
        app_state['analysis_status'] = 'completed'
        app_state['last_analysis'] = {
            'timestamp': datetime.now().isoformat(),
            'results': results,
            'type': 'incremental'
        }
        
        return jsonify({
            'success': True,
            'message': 'Changes pulled and analyzed successfully',
            'results': results
        })
        
    except Exception as e:
        app_state['analysis_status'] = 'error'
        logger.error(f"Error pulling changes: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/knowledge-graph/stats')
def knowledge_graph_stats():
    """Get knowledge graph statistics"""
    try:
        if not gater.kg_manager.graph:
            return jsonify({'error': 'No knowledge graph loaded'}), 404
        
        stats = gater.kg_manager.get_graph_stats()
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error getting knowledge graph stats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/knowledge-graph/query', methods=['POST'])
def query_knowledge_graph():
    """Query the knowledge graph"""
    try:
        data = request.get_json()
        query_type = data.get('type', 'entities')
        filters = data.get('filters', {})
        
        if query_type == 'entities':
            result = gater.kg_manager.get_entities_by_type(filters.get('entity_type'))
        elif query_type == 'relationships':
            result = gater.kg_manager.get_relationships_by_type(filters.get('relationship_type'))
        elif query_type == 'neighbors':
            entity_id = filters.get('entity_id')
            if not entity_id:
                return jsonify({'error': 'entity_id required for neighbors query'}), 400
            result = gater.kg_manager.get_entity_neighbors(entity_id)
        else:
            return jsonify({'error': 'Invalid query type'}), 400
        
        return jsonify({
            'success': True,
            'query_type': query_type,
            'filters': filters,
            'results': result
        })
        
    except Exception as e:
        logger.error(f"Error querying knowledge graph: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/knowledge-graph/data')
def get_knowledge_graph_data():
    """Get complete knowledge graph data for visualization"""
    try:
        # Get all entities and relationships
        entities = []
        relationships = []
        
        # Try to get data from Kuzu first
        if gater.kg_manager.kuzu_manager and hasattr(gater.kg_manager, 'get_kuzu_nodes'):
            try:
                kuzu_nodes = gater.kg_manager.get_kuzu_nodes(limit=1000)
                kuzu_relationships = gater.kg_manager.get_kuzu_relationships(limit=1000)
                
                # Convert Kuzu data to visualization format
                for node in kuzu_nodes:
                    node_data = node.get('data', {})
                    entities.append({
                        'id': node_data.get('id', ''),
                        'name': node_data.get('name', 'Unknown'),
                        'type': node_data.get('type', 'unknown'),
                        'file_path': node_data.get('file_path', ''),
                        'table': node.get('table', 'Unknown')
                    })
                
                for rel in kuzu_relationships:
                    relationships.append({
                        'source': rel.get('source', ''),
                        'target': rel.get('target', ''),
                        'type': rel.get('type', 'unknown')
                    })
                    
            except Exception as e:
                logger.warning(f"Could not get Kuzu data: {e}")
        
        # Fallback to in-memory graph if Kuzu fails or is empty
        if not entities and gater.kg_manager.graph:
            try:
                # Get nodes from NetworkX graph
                for node_id in gater.kg_manager.graph.nodes():
                    node_data = gater.kg_manager.graph.nodes[node_id]
                    entities.append({
                        'id': node_id,
                        'name': node_data.get('name', node_id),
                        'type': node_data.get('type', 'unknown'),
                        'file_path': node_data.get('file_path', ''),
                        'table': 'NetworkX'
                    })
                
                # Get edges from NetworkX graph
                for source, target, edge_data in gater.kg_manager.graph.edges(data=True):
                    relationships.append({
                        'source': source,
                        'target': target,
                        'type': edge_data.get('type', 'unknown')
                    })
                    
            except Exception as e:
                logger.warning(f"Could not get NetworkX data: {e}")
        
        # Get statistics
        stats = gater.kg_manager.get_statistics() if hasattr(gater.kg_manager, 'get_statistics') else {}
        
        return jsonify({
            'success': True,
            'entities': entities,
            'relationships': relationships,
            'statistics': {
                'total_nodes': len(entities),
                'total_relationships': len(relationships),
                'node_types': len(set(e['type'] for e in entities)),
                'relationship_types': len(set(r['type'] for r in relationships)),
                **stats
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting knowledge graph data: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/export/<format>')
def export_data(format):
    """Export knowledge graph data in various formats"""
    from flask import send_file, Response
    import csv
    import io
    
    try:
        if not is_authenticated():
            return jsonify({'error': 'Authentication required'}), 401
        
        # Get all entities from knowledge graph
        entities = []
        for node_id in gater.kg_manager.graph.nodes():
            node_data = dict(gater.kg_manager.graph.nodes[node_id])
            node_data['id'] = node_id
            entities.append(node_data)
        
        # Get all relationships
        relationships = []
        for source, target, edge_data in gater.kg_manager.graph.edges(data=True):
            rel = dict(edge_data)
            rel['source'] = source
            rel['target'] = target
            relationships.append(rel)
        
        if format == 'jsonl':
            # Export as JSONL file (line-delimited JSON)
            output = io.StringIO()
            for entity in entities:
                output.write(json.dumps(entity, default=str) + '\n')
            for rel in relationships:
                output.write(json.dumps(rel, default=str) + '\n')
            
            output.seek(0)
            return Response(
                output.getvalue(),
                mimetype='application/x-ndjson',
                headers={'Content-Disposition': 'attachment; filename=knowledge_graph.jsonl'}
            )
            
        elif format == 'json':
            # Export as single JSON file
            export_data = {
                'entities': entities,
                'relationships': relationships,
                'statistics': gater.kg_manager.get_statistics(),
                'exported_at': datetime.now().isoformat()
            }
            return Response(
                json.dumps(export_data, indent=2, default=str),
                mimetype='application/json',
                headers={'Content-Disposition': 'attachment; filename=knowledge_graph.json'}
            )
            
        elif format == 'csv':
            # Export entities as CSV
            output = io.StringIO()
            
            if entities:
                # Get all unique keys across all entities
                all_keys = set()
                for entity in entities:
                    all_keys.update(entity.keys())
                
                # Sort keys for consistent column order
                fieldnames = sorted(list(all_keys))
                
                writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
                writer.writeheader()
                for entity in entities:
                    # Convert non-string values to strings
                    row = {k: str(v) if v is not None else '' for k, v in entity.items()}
                    writer.writerow(row)
            
            output.seek(0)
            return Response(
                output.getvalue(),
                mimetype='text/csv',
                headers={'Content-Disposition': 'attachment; filename=knowledge_graph.csv'}
            )
        else:
            return jsonify({'error': f'Unsupported export format: {format}. Supported: json, jsonl, csv'}), 400
            
    except Exception as e:
        logger.error(f"Error exporting data: {e}")
        return jsonify({'error': str(e)}), 500

# Kuzu Database Endpoints
@app.route('/kuzu/stats')
def kuzu_stats():
    """Get Kuzu database statistics"""
    try:
        if not is_authenticated():
            return jsonify({'error': 'Authentication required'}), 401
        
        stats = gater.kg_manager.get_kuzu_stats()
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error getting Kuzu stats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/kuzu/nodes')
def kuzu_nodes():
    """Get all nodes from Kuzu database"""
    try:
        if not is_authenticated():
            return jsonify({'error': 'Authentication required'}), 401
        
        limit = request.args.get('limit', 100, type=int)
        nodes = gater.kg_manager.get_kuzu_nodes(limit)
        
        return jsonify({
            'nodes': nodes,
            'count': len(nodes),
            'limit': limit
        })
        
    except Exception as e:
        logger.error(f"Error getting Kuzu nodes: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/kuzu/relationships')
def kuzu_relationships():
    """Get all relationships from Kuzu database"""
    try:
        if not is_authenticated():
            return jsonify({'error': 'Authentication required'}), 401
        
        limit = request.args.get('limit', 100, type=int)
        relationships = gater.kg_manager.get_kuzu_relationships(limit)
        
        return jsonify({
            'relationships': relationships,
            'count': len(relationships),
            'limit': limit
        })
        
    except Exception as e:
        logger.error(f"Error getting Kuzu relationships: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/kuzu/clear', methods=['POST'])
def kuzu_clear():
    """Clear Kuzu database"""
    try:
        if not is_authenticated():
            return jsonify({'error': 'Authentication required'}), 401
        
        if not gater.kg_manager.kuzu_manager:
            return jsonify({
                'success': False,
                'message': 'Kuzu database is not available. Install kuzu library to enable database features.'
            }), 200
        
        success = gater.kg_manager.kuzu_manager.clear_database()
        
        if success:
            return jsonify({
                'success': True,
                'message': 'SUCCESS: Kuzu database cleared successfully'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'ERROR: Failed to clear Kuzu database'
            }), 500
        
    except Exception as e:
        logger.error(f"Error clearing Kuzu database: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/kgcompass/calculate-relevance', methods=['POST'])
def calculate_kgcompass_relevance():
    """Calculate KGCompass relevance scores for a problem description"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        problem_description = data.get('problem_description', '').strip()
        if not problem_description:
            return jsonify({'error': 'Problem description is required'}), 400
        
        # Get optional parameters
        alpha = data.get('alpha', 0.3)
        beta = data.get('beta', 0.6)
        top_k = data.get('top_k', 20)
        
        logger.info(f"KGCompass: Calculating relevance for: '{problem_description[:50]}...'")
        logger.debug(f"KGCompass parameters: α={alpha}, β={beta}, top_k={top_k}")
        
        # Validate parameters
        if not (0 <= alpha <= 1):
            return jsonify({'error': 'Alpha must be between 0 and 1'}), 400
        if not (0.1 <= beta <= 1):
            return jsonify({'error': 'Beta must be between 0.1 and 1'}), 400
        if not (1 <= top_k <= 100):
            return jsonify({'error': 'Top K must be between 1 and 100'}), 400
        
        # Update GATeR's relevance scorer parameters
        if hasattr(gater, 'relevance_scorer') and gater.relevance_scorer:
            gater.relevance_scorer.relevance_scorer.alpha = alpha
            gater.relevance_scorer.relevance_scorer.beta = beta
            gater.relevance_scorer.top_k = top_k
            logger.debug(f"Updated KGCompass parameters: α={alpha}, β={beta}")
        
        # Calculate relevance scores
        import time
        start_time = time.time()
        
        relevance_results = gater.calculate_relevance_scores(
            problem_description=problem_description,
            issue_context=None
        )
        
        end_time = time.time()
        scoring_time = end_time - start_time
        
        if relevance_results.get('success', False):
            # Format results for frontend
            top_candidates = relevance_results.get('top_candidates', [])
            
            # Convert RelevanceScore objects to dictionaries if needed
            formatted_candidates = []
            for candidate in top_candidates:
                if hasattr(candidate, '__dict__'):
                    # It's a RelevanceScore object
                    formatted_candidate = {
                        'entity_id': candidate.entity_id,
                        'entity_name': candidate.entity_name,
                        'entity_type': candidate.entity_type,
                        'score': candidate.total_score,  # Frontend expects 'score'
                        'total_score': candidate.total_score,  # Keep original for backward compatibility
                        'semantic_similarity': candidate.semantic_similarity,
                        'textual_similarity': candidate.textual_similarity,
                        'path_length': candidate.path_length,
                        'path_decay_factor': candidate.path_decay_factor,
                        'file_path': candidate.file_path or 'N/A',
                        'path_info': candidate.path_info
                    }
                    # Debug: Log the score value
                    logger.debug(f"Entity {candidate.entity_name}: total_score={candidate.total_score}, type={type(candidate.total_score)}")
                else:
                    # It's already a dictionary - create a copy to avoid modifying original
                    formatted_candidate = dict(candidate)
                    # Ensure both 'score' and 'total_score' are present for compatibility
                    if 'total_score' in formatted_candidate:
                        formatted_candidate['score'] = formatted_candidate['total_score']
                    elif 'score' in formatted_candidate:
                        formatted_candidate['total_score'] = formatted_candidate['score']
                    logger.debug(f"Dictionary candidate: score={formatted_candidate.get('score')}, total_score={formatted_candidate.get('total_score')}")
                
                # Convert numpy types to Python types for JSON serialization
                formatted_candidate = convert_numpy_types(formatted_candidate)
                
                # Debug: Log after conversion
                logger.debug(f"After conversion - score: {formatted_candidate.get('score')}, type: {type(formatted_candidate.get('score'))}")
                
                formatted_candidates.append(formatted_candidate)
            
            # Prepare debug information
            debug_info = {
                'graph_stats': {
                    'nodes': gater.kg_manager.graph.number_of_nodes() if gater.kg_manager.graph else 0,
                    'edges': gater.kg_manager.graph.number_of_edges() if gater.kg_manager.graph else 0
                },
                'parameters': {
                    'alpha': alpha,
                    'beta': beta,
                    'top_k': top_k,
                    'problem_length': len(problem_description)
                },
                'scoring_details': {
                    'total_candidates_found': len(formatted_candidates),
                    'scoring_time_seconds': scoring_time,
                    'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
                }
            }
            
            # Add score distribution info
            if formatted_candidates:
                scores = [c.get('score', 0) for c in formatted_candidates]
                debug_info['score_distribution'] = {
                    'min': min(scores),
                    'max': max(scores),
                    'mean': sum(scores) / len(scores),
                    'count_above_0_5': sum(1 for s in scores if s > 0.5),
                    'count_above_0_3': sum(1 for s in scores if s > 0.3),
                    'count_above_0_1': sum(1 for s in scores if s > 0.1)
                }
            
            response_data = {
                'success': True,
                'step': 5,
                'problem_description': problem_description,
                'total_candidates_scored': relevance_results.get('total_candidates_scored', len(formatted_candidates)),
                'top_candidates': formatted_candidates[:top_k],
                'scoring_time': scoring_time,
                'debug_info': debug_info,
                'timestamp': relevance_results.get('timestamp', time.strftime('%Y-%m-%d %H:%M:%S'))
            }
            
            logger.info(f"KGCompass: Successfully calculated {len(formatted_candidates)} relevance scores in {scoring_time:.2f}s")
            
            # Final conversion of entire response to handle any remaining numpy types
            response_data = convert_numpy_types(response_data)
            return jsonify(response_data)
            
        else:
            error_msg = relevance_results.get('error', 'Unknown error in relevance calculation')
            logger.error(f"KGCompass: Calculation failed: {error_msg}")
            
            return jsonify({
                'success': False,
                'error': error_msg,
                'debug_info': {
                    'problem_description': problem_description,
                    'parameters': {'alpha': alpha, 'beta': beta, 'top_k': top_k},
                    'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
                }
            }), 500
        
    except Exception as e:
        logger.error(f"KGCompass: Error in calculate_relevance endpoint: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'debug_info': {
                'error_type': type(e).__name__,
                'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
            }
        }), 500

def is_authenticated():
    """Check if user is authenticated via session or Authorization header token"""
    # First check Flask session (traditional OAuth flow)
    if 'oauth_token' in session and 'user' in session:
        return True
    
    # Check for Authorization header (for API calls from Next.js frontend)
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]  # Remove 'Bearer ' prefix
        if token and len(token) > 10:  # Basic validation
            return True
    
    # Check for X-GitHub-Token header (alternative for Next.js frontend)
    github_token = request.headers.get('X-GitHub-Token', '')
    if github_token and len(github_token) > 10:
        return True
    
    return False

def get_github_token():
    """Get GitHub token from session or headers"""
    # First check Flask session
    if 'oauth_token' in session:
        return session['oauth_token'].get('access_token')
    
    # Check Authorization header
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    
    # Check X-GitHub-Token header
    return request.headers.get('X-GitHub-Token', '')

def parse_repo_url(url):
    """Parse repository owner and name from GitHub URL"""
    try:
        # Handle different URL formats
        if url.startswith('https://github.com/'):
            parts = url.replace('https://github.com/', '').rstrip('/').split('/')
        elif url.startswith('git@github.com:'):
            parts = url.replace('git@github.com:', '').split('/')
        elif '/' in url and not url.startswith('http'):
            # Assume owner/repo format
            parts = url.split('/')
        else:
            return None, None
        
        if len(parts) >= 2:
            owner = parts[0]
            repo_name = parts[1]
            
            # Remove .git suffix if present
            if repo_name.endswith('.git'):
                repo_name = repo_name[:-4]
                
            return owner, repo_name
        return None, None
        
    except Exception:
        return None, None

# ========== Vector Storage Endpoints (Step 6) ==========

@app.route('/vectors/sync', methods=['POST'])
def sync_vectors():
    """
    Sync embeddings from knowledge graph to LanceDB
    POST /vectors/sync
    Body: { "full_sync": true/false }
    """
    if not is_authenticated():
        return jsonify({'error': 'Authentication required'}), 401
    
    if not lance_manager or not lance_manager.is_available():
        return jsonify({
            'success': False,
            'error': 'Vector storage not available',
            'message': 'LanceDB is not installed or configured'
        }), 503
    
    try:
        data = request.get_json() or {}
        full_sync = data.get('full_sync', True)
        
        if full_sync:
            # Full sync from knowledge graph
            logger.info("Starting full vector sync")
            result = embedding_sync.sync_from_knowledge_graph(
                gater.kg_manager,
                gater.relevance_scorer
            )
        else:
            # Incremental sync (not yet implemented)
            return jsonify({
                'success': False,
                'error': 'Incremental sync not yet implemented'
            }), 400
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error syncing vectors: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/vectors/search', methods=['POST'])
def search_vectors():
    """
    Semantic search in vector database
    POST /vectors/search
    Body: { 
        "query": "problem description", 
        "top_k": 20,
        "filters": {"entity_type": ["function", "method"]},
        "use_hybrid": true
    }
    """
    if not is_authenticated():
        return jsonify({'error': 'Authentication required'}), 401
    
    if not lance_manager or not lance_manager.is_available():
        return jsonify({
            'success': False,
            'error': 'Vector storage not available'
        }), 503
    
    try:
        data = request.get_json()
        query_text = data.get('query', '').strip()
        top_k = data.get('top_k', 20)
        filters = data.get('filters', {})
        use_hybrid = data.get('use_hybrid', True)
        
        if not query_text:
            return jsonify({'error': 'Query text is required'}), 400
        
        # Generate query embedding
        query_embedding = gater.relevance_scorer.embedding_generator.generate_embedding(query_text)
        
        # Perform search
        if use_hybrid and filters:
            # Hybrid search with filters
            results = vector_indexer.search_with_filters(
                table_name="code_entity_embeddings",
                query_vector=query_embedding,
                filters=filters,
                top_k=top_k
            )
        elif use_hybrid:
            # Hybrid search with relevance boosting
            results = vector_indexer.hybrid_search(
                table_name="code_entity_embeddings",
                query_vector=query_embedding,
                top_k=top_k,
                boost_relevance=0.3
            )
        else:
            # Standard vector search
            results = lance_manager.search_vectors(
                table_name="code_entity_embeddings",
                query_vector=query_embedding,
                top_k=top_k
            )
        
        # Convert numpy types
        results = convert_numpy_types(results)
        
        # Extract results array from response
        if isinstance(results, dict) and 'results' in results:
            # Handle lance_manager response format: {success: True, results: [...], count: N}
            actual_results = results.get('results', [])
            result_count = len(actual_results)
        else:
            # Handle direct list format from vector_indexer methods
            actual_results = results if isinstance(results, list) else []
            result_count = len(actual_results)
        
        return jsonify({
            'success': True,
            'query': query_text,
            'total_results': result_count,
            'results': actual_results
        })
        
    except Exception as e:
        logger.error(f"Error searching vectors: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/vectors/stats')
def vector_stats():
    """
    Get vector database statistics
    GET /vectors/stats
    """
    if not is_authenticated():
        return jsonify({'error': 'Authentication required'}), 401
    
    if not step6_vector_storage or not step6_vector_storage.is_available():
        return jsonify({
            'available': False,
            'error': 'Vector storage not available'
        })
    
    try:
        # Get database stats from Step 6
        db_stats = step6_vector_storage.get_database_stats()
        
        # Get detailed table stats if table exists
        table_stats = None
        vectors_data = []
        
        if 'code_entity_embeddings' in db_stats.get('tables', []):
            table_stats = lance_manager.get_table_stats("code_entity_embeddings")
            
            # Get sample of stored vectors
            try:
                table = lance_manager.db.open_table("code_entity_embeddings")
                df = table.to_pandas()
                
                # Limit to first 50 records for performance
                df = df.head(50)
                
                # Convert to list of dicts, excluding embedding vectors (too large)
                for _, row in df.iterrows():
                    vectors_data.append({
                        'entity_id': row.get('entity_id', ''),
                        'entity_name': row.get('entity_name', ''),
                        'entity_type': row.get('entity_type', ''),
                        'file_path': row.get('file_path', ''),
                        'line_start': int(row.get('line_start', 0)),
                        'line_end': int(row.get('line_end', 0)),
                        'relevance_score': float(row.get('relevance_score', 0)),
                        'semantic_similarity': float(row.get('semantic_similarity', 0)),
                        'textual_similarity': float(row.get('textual_similarity', 0)),
                        'code_snippet': row.get('code_snippet', '')[:200],  # Truncate long snippets
                        'created_at': str(row.get('created_at', '')),
                        'embedding_dims': len(row.get('embedding', [])) if row.get('embedding') is not None else 0
                    })
            except Exception as e:
                logger.warning(f"Could not retrieve vector data: {e}")
        
        embedding_cache_stats = {}
        try:
            if hasattr(gater, 'relevance_scorer') and gater.relevance_scorer and hasattr(
                gater.relevance_scorer, 'embedding_generator'
            ):
                embedding_cache_stats = gater.relevance_scorer.embedding_generator.get_cache_stats()
        except Exception as e:
            logger.debug(f"Embedding cache stats unavailable: {e}")
        
        return jsonify({
            'success': True,
            'available': True,
            'total_vectors': db_stats.get('total_vectors', 0),
            'table_count': db_stats.get('table_count', 0),
            'tables': db_stats.get('tables', []),
            'status': db_stats.get('status', 'unknown'),
            'table_details': table_stats,
            'vectors_data': vectors_data,
            'data_count': len(vectors_data),
            'embedding_cache': embedding_cache_stats,
        })
        
    except Exception as e:
        logger.error(f"Error getting vector stats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/vectors/optimize', methods=['POST'])
def optimize_vectors():
    """
    Optimize vector database (compact and rebuild index)
    POST /vectors/optimize
    """
    if not is_authenticated():
        return jsonify({'error': 'Authentication required'}), 401
    
    if not lance_manager or not lance_manager.is_available():
        return jsonify({
            'success': False,
            'error': 'Vector storage not available'
        }), 503
    
    try:
        # Optimize table
        optimized = vector_indexer.optimize_table("code_entity_embeddings")
        
        # Rebuild index
        indexed = vector_indexer.create_index("code_entity_embeddings")
        
        return jsonify({
            'success': True,
            'optimized': optimized,
            'indexed': indexed,
            'message': 'Vector database optimized successfully'
        })
        
    except Exception as e:
        logger.error(f"Error optimizing vectors: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/vectors/clear', methods=['POST'])
def clear_vectors():
    """
    Clear vector database
    POST /vectors/clear
    """
    if not is_authenticated():
        return jsonify({'error': 'Authentication required'}), 401
    
    if not lance_manager or not lance_manager.is_available():
        return jsonify({
            'success': False,
            'error': 'Vector storage not available'
        }), 503
    
    try:
        success = lance_manager.delete_table("code_entity_embeddings")
        
        return jsonify({
            'success': success,
            'message': 'Vector database cleared successfully' if success else 'Failed to clear'
        })
        
    except Exception as e:
        logger.error(f"Error clearing vectors: {e}")
        return jsonify({'error': str(e)}), 500

# Vector Storage API Endpoints (Step 6)

@app.route('/vectors/store', methods=['POST'])
def store_vectors():
    """
    Store embeddings in LanceDB
    POST /vectors/store  
    Body: { "sync_all": true/false }
    """
    try:
        if not is_authenticated():
            return jsonify({'error': 'Authentication required'}), 401
        
        data = request.get_json() or {}
        sync_all = data.get('sync_all', False)
        
        # Use vector storage from gater
        if hasattr(gater, 'vector_storage'):
            if sync_all:
                results = gater.vector_storage.store_embeddings()
            else:
                results = gater.vector_storage.incremental_sync()
            
            return jsonify({
                'success': True,
                'vectors_stored': results.get('vectors_stored', 0),
                'processing_time': results.get('processing_time', 0)
            })
        else:
            return jsonify({
                'success': False, 
                'error': 'Vector storage not initialized'
            }), 500
            
    except Exception as e:
        logger.error(f"Error storing vectors: {e}")
        return jsonify({'error': str(e)}), 500

# === NEW VECTOR DATABASE ENDPOINTS ===

@app.route('/vectors/search_entity', methods=['POST'])
def search_entity_vectors():
    """Search stored KGCompass results using semantic similarity"""
    try:
        # Check authentication (allow bypass for development)
        if not is_authenticated() and not os.getenv('DEV_MODE', 'false').lower() == 'true':
            return jsonify({'error': 'Authentication required. Please login or set DEV_MODE=true'}), 401
            
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({'error': 'Query parameter required'}), 400
            
        query = data['query']
        top_k = data.get('top_k', 10)
        
        if not step6_vector_storage:
            return jsonify({
                'error': 'Vector storage not available',
                'results': [],
                'total_found': 0
            }), 503
        
        # Search stored KGCompass results
        logger.info(f"Searching KGCompass results for: '{query}'")
        search_result = step6_vector_storage.search_similar_entities(query, top_k=top_k)
        
        if search_result['success']:
            results = search_result.get('results', [])
            
            # Store results globally for display
            search_id = f"search_{len(vector_search_results) + 1}"
            vector_search_results[search_id] = {
                'query': query,
                'results': results,
                'timestamp': datetime.now().isoformat(),
                'total_found': len(results)
            }
            
            logger.info(f"Found {len(results)} similar entities")
            
            return jsonify({
                'success': True,
                'search_id': search_id,
                'query': query,
                'results': results,
                'total_found': len(results),
                'message': f"Found {len(results)} KGCompass-scored entities"
            })
        else:
            return jsonify({
                'success': False,
                'results': [],
                'total_found': 0,
                'error': search_result.get('message', 'No stored results found. Run KGCompass scoring first.')
            })
            
    except Exception as e:
        logger.error(f"Vector entity search error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'results': [],
            'error': str(e)
        }), 500

@app.route('/vectors/store_kg_entities', methods=['POST'])
def store_kg_entities():
    """
    Retrieve stored KGCompass results from LanceDB
    NOTE: Storage happens automatically after Step 5 KGCompass scoring
    This endpoint just returns stats about what's stored
    """
    try:
        # Check authentication (allow bypass for development)
        if not is_authenticated() and not os.getenv('DEV_MODE', 'false').lower() == 'true':
            return jsonify({'error': 'Authentication required. Please login or set DEV_MODE=true'}), 401
            
        if not step6_vector_storage:
            return jsonify({
                'error': 'Vector storage not available',
                'stored_count': 0
            }), 503
        
        # Get stats from LanceDB about stored KGCompass results
        stats = step6_vector_storage.get_database_stats()
        
        return jsonify({
            'success': True,
            'message': 'KGCompass results are automatically stored after Step 5 scoring',
            'stored_count': stats.get('total_vectors', 0),
            'table_count': stats.get('table_count', 0),
            'tables': stats.get('tables', []),
            'status': stats.get('status', 'unknown'),
            'note': 'Run KGCompass scoring to populate vector database'
        })
        
    except Exception as e:
        logger.error(f"Error retrieving vector stats: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e),
            'stored_count': 0
        }), 500

@app.route('/vectors/search_results', methods=['GET'])
def get_vector_search_results():
    """Get stored vector search results for display"""
    try:
        # Check authentication
        if 'access_token' not in session:
            return jsonify({'error': 'Authentication required'}), 401
            
        search_id = request.args.get('search_id')
        
        if search_id and search_id in vector_search_results:
            return jsonify(vector_search_results[search_id])
        else:
            return jsonify({
                'all_searches': list(vector_search_results.keys()),
                'total_searches': len(vector_search_results),
                'recent_results': dict(list(vector_search_results.items())[-5:])  # Last 5 searches
            })
            
    except Exception as e:
        logger.error(f"Error retrieving search results: {e}")
        return jsonify({'error': str(e)}), 500


# ========== GATR - Graph-Aware Test Repair Endpoints ==========

# Initialize GATR Engine
gatr_engine = None
try:
    from src.gatr import GATREngine
    gatr_engine = GATREngine(
        kg_manager=gater.kg_manager if gater else None,
        vector_storage=step6_vector_storage,
        relevance_scorer=gater.relevance_scorer if hasattr(gater, 'relevance_scorer') else None
    )
    logger.info("SUCCESS: GATR Engine initialized successfully")
except Exception as e:
    logger.warning(f"⚠️ GATR Engine initialization failed: {e}")
    gatr_engine = None

# Store GATR repair results
gatr_repair_results = {}


@app.route('/gatr/repair', methods=['POST'])
def gatr_repair_test():
    """
    GATR Test Repair Endpoint
    Execute the complete GATR pipeline to repair a broken test
    
    POST /gatr/repair
    Body: {
        "test_name": "test_function_name",
        "test_code": "def test_something():\n    ...",
        "test_file": "tests/test_module.py",
        "error_message": "AssertionError: expected X but got Y",
        "test_class": "TestClassName" (optional)
    }
    """
    try:
        # GATR repair is available without authentication for development
        # Authentication can be enforced in production by setting REQUIRE_AUTH=true
        if os.getenv('REQUIRE_AUTH', 'false').lower() == 'true':
            if not is_authenticated():
                return jsonify({'error': 'Authentication required'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        # Validate required fields
        test_name = data.get('test_name', '').strip()
        test_code = data.get('test_code', '').strip()
        error_message = data.get('error_message', '').strip()
        project_name = data.get('project_name', '').strip() or 'default_project'
        include_debug_trace = bool(data.get('include_debug_trace', True))
        
        if not test_name:
            return jsonify({'error': 'test_name is required'}), 400
        if not test_code:
            return jsonify({'error': 'test_code is required'}), 400
        if not error_message:
            return jsonify({'error': 'error_message is required'}), 400
        
        # Check if GATR engine is available
        if not gatr_engine:
            return jsonify({
                'success': False,
                'error': 'GATR Engine not available. Please check server logs.'
            }), 503
        
        logger.info(f"GATR: Starting repair for test: {test_name} (project: {project_name})")
        
        # Build broken test info
        broken_test = {
            'test_name': test_name,
            'test_code': test_code,
            'test_file': data.get('test_file', ''),
            'test_class': data.get('test_class', ''),
            'line_number': data.get('line_number')
        }
        
        # Execute GATR repair pipeline with project name for saving
        repair_result = gatr_engine.repair_test(broken_test, error_message, project_name=project_name)
        
        # Store result
        repair_id = f"repair_{len(gatr_repair_results) + 1}_{int(time.time())}"
        gatr_repair_results[repair_id] = {
            'repair_id': repair_id,
            'test_name': test_name,
            'project_name': project_name,
            'success': repair_result.success,
            'repaired_code': repair_result.repaired_code,
            'repair_strategy': repair_result.repair_strategy,
            'llm_used': bool((repair_result.context_summary or {}).get('repair_method', '').startswith('graphrag_llm')),
            'repair_method': (repair_result.context_summary or {}).get('repair_method', ''),
            'confidence': repair_result.confidence,
            'processing_time': repair_result.processing_time,
            'context_summary': repair_result.context_summary,
            'raw_context_details': repair_result.raw_context_details,
            'compressed_context_details': repair_result.compressed_context_details,
            'aggregated_context_details': repair_result.aggregated_context_details,
            'retrieval_trace': repair_result.retrieval_trace if include_debug_trace else {},
            'final_rag_prompt': repair_result.final_rag_prompt if include_debug_trace else {},
            'error_message': repair_result.error_message,
            'diff_file_path': repair_result.diff_file_path,
            'diff_content': repair_result.diff_content,
            'timestamp': datetime.now().isoformat()
        }
        
        if repair_result.success:
            logger.info(f"GATR: Repair successful for {test_name} (strategy: {repair_result.repair_strategy})")
            response_data = {
                'success': True,
                'repair_id': repair_id,
                'test_name': test_name,
                'project_name': project_name,
                'repaired_code': repair_result.repaired_code,
                'repair_strategy': repair_result.repair_strategy,
                'llm_used': bool((repair_result.context_summary or {}).get('repair_method', '').startswith('graphrag_llm')),
                'repair_method': (repair_result.context_summary or {}).get('repair_method', ''),
                'confidence': repair_result.confidence,
                'processing_time': repair_result.processing_time,
                'context_summary': repair_result.context_summary,
                'pipeline_progress': repair_result.pipeline_progress,
                'raw_context_details': repair_result.raw_context_details,
                'compressed_context_details': repair_result.compressed_context_details,
                'aggregated_context_details': repair_result.aggregated_context_details,
                'retrieval_trace': repair_result.retrieval_trace if include_debug_trace else {},
                'final_rag_prompt': repair_result.final_rag_prompt if include_debug_trace else {},
                'diff_file_path': repair_result.diff_file_path,
                'diff_content': repair_result.diff_content
            }
            return jsonify(convert_numpy_types(response_data))
        else:
            logger.warning(f"GATR: Repair failed for {test_name}: {repair_result.error_message}")
            return jsonify({
                'success': False,
                'repair_id': repair_id,
                'test_name': test_name,
                'error': repair_result.error_message,
                'processing_time': repair_result.processing_time
            }), 500
        
    except Exception as e:
        logger.error(f"GATR repair error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/gatr/context', methods=['POST'])
def gatr_get_context():
    """
    Get GATR repair context without generating repair
    Useful for debugging and understanding the repair process
    
    POST /gatr/context
    Body: same as /gatr/repair
    """
    try:
        # Check authentication
        if not is_authenticated() and not os.getenv('DEV_MODE', 'false').lower() == 'true':
            return jsonify({'error': 'Authentication required'}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        test_name = data.get('test_name', '').strip()
        test_code = data.get('test_code', '').strip()
        error_message = data.get('error_message', '').strip()
        
        if not gatr_engine:
            return jsonify({
                'success': False,
                'error': 'GATR Engine not available'
            }), 503
        
        broken_test = {
            'test_name': test_name,
            'test_code': test_code,
            'test_file': data.get('test_file', ''),
            'test_class': data.get('test_class', '')
        }
        
        # Get context without repair
        context = gatr_engine.get_repair_context(broken_test, error_message)
        
        return jsonify({
            'success': True,
            'test_name': test_name,
            'context': convert_numpy_types(context)
        })
        
    except Exception as e:
        logger.error(f"GATR context error: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/gatr/results')
def gatr_get_results():
    """Get stored GATR repair results"""
    try:
        repair_id = request.args.get('repair_id')
        
        if repair_id and repair_id in gatr_repair_results:
            return jsonify(gatr_repair_results[repair_id])
        else:
            # Return summary of all repairs
            return jsonify({
                'total_repairs': len(gatr_repair_results),
                'successful_repairs': sum(1 for r in gatr_repair_results.values() if r.get('success')),
                'recent_repairs': list(gatr_repair_results.values())[-10:]
            })
            
    except Exception as e:
        logger.error(f"Error retrieving GATR results: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/gatr/status')
def gatr_status():
    """Get GATR engine status including direct database connections and LLM status"""
    if gatr_engine is None:
        return jsonify({
            'available': False,
            'error': 'GATR Engine not initialized'
        })
    
    # Get LLM status
    llm_status = gatr_engine.get_llm_status()
    
    # Get direct database status
    db_status = gatr_engine.get_database_status()
    
    return jsonify({
        'available': True,
        'kg_manager_available': gatr_engine.kg_manager is not None,
        'vector_storage_available': gatr_engine.vector_storage is not None,
        'relevance_scorer_available': gatr_engine.relevance_scorer is not None,
        'total_repairs': len(gatr_repair_results),
        'successful_repairs': sum(1 for r in gatr_repair_results.values() if r.get('success')),
        'databases': {
            'kuzu': {
                'connected': db_status['kuzu']['connected'],
                'path': db_status['kuzu']['path'],
                'entities': db_status['kuzu']['entities'],
                'edges': db_status['kuzu']['edges']
            },
            'lancedb': {
                'connected': db_status['lancedb']['connected'],
                'path': db_status['lancedb']['path'],
                'embeddings': db_status['lancedb']['embeddings']
            }
        },
        'llm': {
            'provider': llm_status.get('provider', 'lm_studio'),
            'model': llm_status.get('lm_studio_model') or llm_status.get('ollama_model'),
            'url': llm_status.get('lm_studio_url') or llm_status.get('ollama_url'),
            'available': llm_status.get('available', False),
            'target_model_available': llm_status.get('target_model_available', False),
            'installed_models': llm_status.get('models', []),
            'error': llm_status.get('error')
        }
    })


@app.route('/gatr/llm/pull', methods=['POST'])
def gatr_pull_model():
    """
    Pull/download a model (provider dependent)
    
    POST /gatr/llm/pull
    Body: {"model": "<model-id>"} (optional, defaults to configured model)
    """
    try:
        if gatr_engine is None:
            return jsonify({'success': False, 'error': 'GATR Engine not available'}), 503
        
        data = request.get_json() or {}
        model_name = data.get('model')
        
        result = gatr_engine.pull_model(model_name)
        
        if result.get('success'):
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        logger.error(f"Error pulling model: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# Template functions
@app.template_global()
def get_user():
    """Get current user for templates"""
    return session.get('user')

@app.template_global()
def get_app_state():
    """Get app state for templates"""
    return app_state

if __name__ == '__main__':
    # Ensure workspace directories exist
    os.makedirs('workspace/logs', exist_ok=True)
    
    # Load knowledge graph if exists
    try:
        gater.load_knowledge_graph()
        logger.info("Loaded existing knowledge graph")
    except Exception as e:
        logger.info(f"No existing knowledge graph found: {e}")
    
    # Run the Flask app
    logger.info("Starting GATeR Web Server...")
    app.run(debug=False, host='127.0.0.1', port=5000)