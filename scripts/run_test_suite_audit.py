"""
Run GATR Test Suite Audit
Tests the pipeline with multiple test cases and generates comprehensive report
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import json
import requests
import time
from datetime import datetime

def run_test_suite():
    """Run all test cases and generate audit report"""
    
    print("\n" + "="*80)
    print("GATR PIPELINE TEST SUITE AUDIT")
    print("="*80)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Load test suite
    with open('test_cases/jsoup_test_suite.json', 'r') as f:
        test_cases = json.load(f)
    
    print(f"\n📋 Loaded {len(test_cases)} test cases")
    
    # API endpoint
    api_url = "http://localhost:5000/gatr/repair"
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{'='*80}")
        print(f"TEST CASE {i}/{len(test_cases)}: {test_case['name']}")
        print(f"{'='*80}")
        
        # Prepare request
        payload = {
            "test_name": f"test_{i}",
            "test_file": f"Test{i}.java",
            "test_class": f"Test{i}",
            "language": "java",
            "test_code": test_case['test_code'],
            "error_message": test_case['error_message'],
            "line_number": test_case['line_number'],
            "broken_line_numbers": test_case['broken_line_numbers'],
            "project_name": "jsoup_audit"
        }
        
        print(f"\n📤 Sending repair request...")
        
        try:
            start_time = time.time()
            response = requests.post(api_url, json=payload, timeout=60)
            end_time = time.time()
            
            processing_time = end_time - start_time
            
            if response.status_code == 200:
                result_data = response.json()
                
                print(f"\n✅ Repair completed in {processing_time:.2f}s")
                
                # Extract key metrics
                repaired_code = result_data.get('repaired_code', '')
                original_code = test_case['test_code']
                
                # Check if code changed
                code_changed = repaired_code != original_code
                
                # Get context details (correct field names)
                raw_context_details = result_data.get('raw_context_details', {})
                compressed_context_details = result_data.get('compressed_context_details', {})
                
                entities_found = raw_context_details.get('entities_found', 0)
                snippets_found = raw_context_details.get('snippets_found', 0)
                
                snippet_compression = compressed_context_details.get('step_2_3_snippet_compression', {})
                snippets_retained = snippet_compression.get('snippets_retained', 0)
                
                # Analyze repair
                result = {
                    'test_name': test_case['name'],
                    'status': 'success',
                    'processing_time': processing_time,
                    'code_changed': code_changed,
                    'entities_found': entities_found,
                    'snippets_found': snippets_found,
                    'snippets_retained': snippets_retained,
                    'snippet_coverage': (snippets_retained / entities_found * 100) if entities_found > 0 else 0,
                    'repaired_code': repaired_code[:500],  # First 500 chars
                    'error_type': test_case['error_message'].split(':')[0].split('.')[-1]
                }
                
                print(f"\n📊 Metrics:")
                print(f"   Code Changed: {'Yes' if code_changed else 'No'}")
                print(f"   Entities Found: {entities_found}")
                print(f"   Snippets Found: {snippets_found}")
                print(f"   Snippets Retained: {snippets_retained}")
                print(f"   Snippet Coverage: {result['snippet_coverage']:.2f}%")
                
                if not code_changed:
                    print(f"\n⚠️  WARNING: Repaired code is identical to original!")
                
            else:
                print(f"\n❌ Repair failed with status {response.status_code}")
                result = {
                    'test_name': test_case['name'],
                    'status': 'failed',
                    'error': response.text[:200],
                    'processing_time': processing_time
                }
        
        except requests.exceptions.Timeout:
            print(f"\n❌ Request timed out after 60 seconds")
            result = {
                'test_name': test_case['name'],
                'status': 'timeout',
                'processing_time': 60
            }
        
        except Exception as e:
            print(f"\n❌ Error: {e}")
            result = {
                'test_name': test_case['name'],
                'status': 'error',
                'error': str(e),
                'processing_time': 0
            }
        
        results.append(result)
        
        # Wait between requests
        if i < len(test_cases):
            print(f"\n⏳ Waiting 2 seconds before next test...")
            time.sleep(2)
    
    # Generate summary report
    print(f"\n{'='*80}")
    print("AUDIT SUMMARY")
    print(f"{'='*80}")
    
    successful = sum(1 for r in results if r['status'] == 'success')
    failed = sum(1 for r in results if r['status'] == 'failed')
    timeout = sum(1 for r in results if r['status'] == 'timeout')
    errors = sum(1 for r in results if r['status'] == 'error')
    
    print(f"\n📈 Test Results:")
    print(f"   Total Tests: {len(results)}")
    print(f"   Successful: {successful}")
    print(f"   Failed: {failed}")
    print(f"   Timeout: {timeout}")
    print(f"   Errors: {errors}")
    
    if successful > 0:
        successful_results = [r for r in results if r['status'] == 'success']
        
        avg_processing_time = sum(r['processing_time'] for r in successful_results) / len(successful_results)
        avg_entities = sum(r['entities_found'] for r in successful_results) / len(successful_results)
        avg_snippet_coverage = sum(r['snippet_coverage'] for r in successful_results) / len(successful_results)
        
        code_changed_count = sum(1 for r in successful_results if r['code_changed'])
        
        print(f"\n📊 Performance Metrics:")
        print(f"   Avg Processing Time: {avg_processing_time:.2f}s")
        print(f"   Avg Entities Found: {avg_entities:.0f}")
        print(f"   Avg Snippet Coverage: {avg_snippet_coverage:.2f}%")
        print(f"   Code Changed: {code_changed_count}/{successful} ({code_changed_count/successful*100:.0f}%)")
    
    # Identify issues
    print(f"\n{'='*80}")
    print("ISSUES IDENTIFIED")
    print(f"{'='*80}")
    
    issues = []
    
    # Check snippet coverage
    if successful > 0:
        low_coverage_tests = [r for r in results if r['status'] == 'success' and r['snippet_coverage'] < 20]
        if low_coverage_tests:
            issues.append({
                'severity': 'CRITICAL',
                'issue': 'Low Snippet Coverage',
                'description': f'{len(low_coverage_tests)}/{successful} tests had <20% snippet coverage',
                'impact': 'LLM receives insufficient code context, leading to poor repairs',
                'recommendation': 'Re-run repository ingestion with Bug 0 fix to extract code snippets'
            })
    
    # Check code changes
    if successful > 0:
        unchanged_tests = [r for r in results if r['status'] == 'success' and not r['code_changed']]
        if unchanged_tests:
            issues.append({
                'severity': 'HIGH',
                'issue': 'No Code Changes',
                'description': f'{len(unchanged_tests)}/{successful} tests returned unchanged code',
                'impact': 'GATR is not generating repairs, just returning original code',
                'recommendation': 'Check LLM availability and prompt generation'
            })
    
    # Check failures
    if failed > 0 or errors > 0:
        issues.append({
            'severity': 'HIGH',
            'issue': 'Pipeline Failures',
            'description': f'{failed + errors} tests failed or errored',
            'impact': 'Pipeline is not stable',
            'recommendation': 'Check logs for error details'
        })
    
    if not issues:
        print("\n✅ No critical issues found!")
    else:
        for i, issue in enumerate(issues, 1):
            print(f"\n{i}. [{issue['severity']}] {issue['issue']}")
            print(f"   Description: {issue['description']}")
            print(f"   Impact: {issue['impact']}")
            print(f"   Recommendation: {issue['recommendation']}")
    
    # Save detailed report
    report = {
        'timestamp': datetime.now().isoformat(),
        'total_tests': len(results),
        'successful': successful,
        'failed': failed,
        'timeout': timeout,
        'errors': errors,
        'results': results,
        'issues': issues
    }
    
    report_path = f"workspace/data/test_suite_audit_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n💾 Detailed report saved to: {report_path}")
    print(f"\n{'='*80}")
    print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*80}\n")

if __name__ == '__main__':
    try:
        run_test_suite()
    except KeyboardInterrupt:
        print("\n\n⚠️  Audit interrupted by user")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
