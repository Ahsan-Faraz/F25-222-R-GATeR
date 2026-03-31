// Premium Landing Page - Cyber/Technical Aesthetic with Framer Motion

import React, { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { signIn } from 'next-auth/react';
import { 
  Database, Network, Search, Zap, ArrowRight, GitBranch, 
  Shield, Check, Mail,
  Code2, Brain, Eye, Sparkles, ChevronRight, Circle
} from 'lucide-react';

// Custom icons (lucide-react doesn't export Github and Linkedin)
const GithubIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
  </svg>
);

const LinkedinIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

// Animation variants (removing transitions to fix type issues)
const fadeInUp = {
  hidden: { opacity: 0, y: 60 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
};

const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { scale: 1, opacity: 1 }
};

// Animated Section Wrapper
const AnimatedSection = ({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  return (
    <motion.section
      id={id}
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.section>
  );
};

// Feature Card Component
interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  badge: string;
  delay?: number;
}

const FeatureCard = ({ icon: Icon, title, description, badge, delay = 0 }: FeatureCardProps) => (
  <motion.div
    variants={fadeInUp}
    transition={{ duration: 0.8, ease: "easeOut", delay }}
    className="group relative bg-zinc-950/50 backdrop-blur-sm border border-zinc-800/50 rounded-2xl p-8 hover:border-blue-600/50 transition-all duration-500 overflow-hidden"
    whileHover={{ scale: 1.02, y: -4 }}
  >
    {/* Gradient overlay on hover - more subtle */}
    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-zinc-700/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    
    <div className="relative z-10">
      {/* Icon container */}
      <motion.div 
        className="w-14 h-14 bg-blue-600/10 border border-blue-600/20 rounded-xl flex items-center justify-center mb-6"
        whileHover={{ rotate: 360 }}
        transition={{ duration: 0.6 }}
      >
        <Icon className="w-7 h-7 text-blue-400" />
      </motion.div>
      
      {/* Title and badge */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <span className="px-3 py-1 bg-blue-600/10 text-blue-400 text-xs font-mono font-bold rounded-full border border-blue-600/20">
          {badge}
        </span>
      </div>
      
      {/* Description */}
      <p className="text-zinc-400 leading-relaxed">{description}</p>
    </div>
  </motion.div>
);

// Pipeline Node Component
interface PipelineNodeProps {
  step: number;
  title: string;
  icon: React.ElementType;
  description: string;
  isLast?: boolean;
  isLeft?: boolean; // Alternates left/right
}

// Pipeline Node Component - Alternating Tree Structure
const PipelineNode = ({ step, title, icon: Icon, description, isLast, isLeft }: PipelineNodeProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: false, amount: 0.5 });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: isLeft ? -30 : 30 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: step * 0.08 }}
      className={`relative flex items-center gap-4 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}
    >
      {/* Node circle - more subdued colors */}
      <motion.div
        className="relative z-10 w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-500 rounded-full flex items-center justify-center border-4 border-zinc-900 shadow-lg shadow-blue-600/30"
        initial={{ scale: 0 }}
        animate={isInView ? { scale: 1 } : { scale: 0 }}
        transition={{ duration: 0.3, delay: step * 0.08 + 0.1, type: "spring", stiffness: 300 }}
        whileHover={{ scale: 1.1, rotate: 360 }}
      >
        <Icon className="w-10 h-10 text-white" />
      </motion.div>
      
      {/* Horizontal connector line to central vertical line */}
      <motion.div
        className={`absolute ${isLeft ? 'left-24' : 'right-24'} top-12 w-8 h-0.5 bg-gradient-to-${isLeft ? 'r' : 'l'} from-blue-600 to-transparent`}
        initial={{ scaleX: 0 }}
        animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: 0.25, delay: step * 0.08 + 0.15 }}
        style={{ transformOrigin: isLeft ? 'left' : 'right' }}
      />
      
      {/* Content card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.35, delay: step * 0.08 + 0.2 }}
        className="flex-1 max-w-xs"
      >
        <div className="bg-zinc-950/80 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-6 hover:border-blue-600/50 transition-all duration-300 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-blue-400 font-mono text-xs font-bold bg-blue-600/10 px-2 py-1 rounded">
              STEP {step}
            </span>
            <h4 className="text-lg font-bold text-white">{title}</h4>
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Pricing Tier Component
interface PricingTierProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const PricingTier = ({ name, price, period, description, features, cta, highlighted }: PricingTierProps) => (
  <motion.div
    variants={scaleIn}
    transition={{ duration: 0.6, ease: "easeOut" }}
    className={`relative bg-zinc-950/50 backdrop-blur-sm border rounded-2xl p-8 ${
      highlighted 
        ? 'border-blue-600 shadow-xl shadow-blue-600/10 scale-105' 
        : 'border-zinc-800/50 hover:border-zinc-700'
    } transition-all duration-300`}
    whileHover={!highlighted ? { y: -8 } : {}}
  >
    {highlighted && (
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
        MOST POPULAR
      </div>
    )}
    
    <div className="text-center mb-8">
      <h3 className="text-2xl font-bold text-white mb-2">{name}</h3>
      <p className="text-zinc-400 text-sm mb-4">{description}</p>
      <div className="flex items-baseline justify-center gap-1">
        <span className={`text-5xl font-bold ${highlighted ? 'text-blue-400' : 'text-white'}`}>
          {price}
        </span>
        {period && <span className="text-zinc-500">{period}</span>}
      </div>
    </div>
    
    <ul className="space-y-4 mb-8">
      {features.map((feature, i) => (
        <li key={i} className="flex items-start gap-3">
          <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${highlighted ? 'text-blue-400' : 'text-zinc-600'}`} />
          <span className="text-zinc-300 text-sm">{feature}</span>
        </li>
      ))}
    </ul>
    
    <button
      onClick={() => signIn('github')}
      className={`w-full py-4 rounded-xl font-bold transition-all duration-300 ${
        highlighted
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-zinc-800 text-white hover:bg-zinc-700'
      }`}
    >
      {cta}
    </button>
  </motion.div>
);

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const features = [
    {
      icon: GitBranch,
      title: 'Deep Repository Analysis',
      description: 'Parse your entire codebase in seconds. Extract classes, functions, and test relationships with precision.',
      badge: 'Sub-second'
    },
    {
      icon: Database,
      title: 'Semantic Vector Search',
      description: 'AI-powered embeddings for lightning-fast context retrieval. Find related code instantly.',
      badge: '99% accuracy'
    },
    {
      icon: Network,
      title: 'Knowledge Graph',
      description: 'Visualize code dependencies and relationships. Navigate your codebase like never before.',
      badge: 'Real-time'
    },
    {
      icon: Zap,
      title: 'Automated Test Repair',
      description: 'RAG-powered LLM repairs failing tests with full context awareness. No hallucinations.',
      badge: 'Context-faithful'
    }
  ];

  const pipelineSteps = [
    { title: 'Repository Clone', icon: GitBranch, description: 'Pull and parse codebase structure' },
    { title: 'Entity Extraction', icon: Code2, description: 'Extract classes, functions, tests' },
    { title: 'Knowledge Graph', icon: Network, description: 'Build semantic relationships' },
    { title: 'Vector Embeddings', icon: Brain, description: 'Generate AI embeddings' },
    { title: 'KGCompass Scoring', icon: Eye, description: 'Rank entity relevance' },
    { title: 'LLM Repair', icon: Sparkles, description: 'Generate context-aware fixes' }
  ];

  const pricingTiers = [
    {
      name: 'Open Source',
      price: 'Free',
      description: 'Perfect for individual developers',
      features: [
        'Unlimited repositories',
        'Basic knowledge graph',
        'Vector search',
        'Community support',
        'Self-hosted deployment'
      ],
      cta: 'Get Started'
    },
    {
      name: 'Pro',
      price: '$49',
      period: '/month',
      description: 'For teams building production apps',
      features: [
        'Everything in Open Source',
        'Advanced KGCompass scoring',
        'Priority LLM access',
        'Incremental analysis',
        'GitHub artifact integration',
        'Priority support',
        'Cloud hosting included'
      ],
      cta: 'Start Free Trial',
      highlighted: true
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'Tailored for large organizations',
      features: [
        'Everything in Pro',
        'Dedicated infrastructure',
        'Custom LLM fine-tuning',
        'On-premise deployment',
        'SLA guarantee',
        '24/7 premium support',
        'Training & onboarding'
      ],
      cta: 'Contact Sales'
    }
  ];

  const team = [
    { name: 'Mirza Mukarram', role: 'Lead Developer', university: 'NUCES Islamabad' },
    { name: 'Team Member 2', role: 'ML Engineer', university: 'NUCES Islamabad' },
    { name: 'Team Member 3', role: 'Backend Developer', university: 'NUCES Islamabad' },
    { name: 'Team Member 4', role: 'Frontend Developer', university: 'NUCES Islamabad' }
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Animated background grid */}
      <motion.div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.5) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          y: backgroundY
        }}
      />

      {/* Gradient orbs - More subtle */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-zinc-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Sticky Navigation */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/50 bg-black/90 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-500 rounded-lg flex items-center justify-center">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tighter">GATeR</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <a href="#features" className="text-zinc-400 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-zinc-400 hover:text-white transition-colors">How it Works</a>
            <a href="#pricing" className="text-zinc-400 hover:text-white transition-colors">Pricing</a>
            <a href="#about" className="text-zinc-400 hover:text-white transition-colors">About</a>
          </nav>

          <button
            onClick={() => signIn('github')}
            className="flex items-center gap-2 bg-white text-black font-semibold py-2 px-5 rounded-lg hover:bg-zinc-100 transition-all hover:scale-105 text-sm"
          >
            <GithubIcon className="w-4 h-4" />
            Sign in
          </button>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-32">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-5xl mx-auto text-center"
          style={{ opacity }}
        >
          {/* Badge */}
          <motion.div
            variants={fadeInUp}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-full text-sm"
          >
            <Circle className="w-2 h-2 fill-blue-400 text-blue-400 animate-pulse" />
            <span className="text-zinc-400">FYP 2022–2026</span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400">NUCES Islamabad</span>
          </motion.div>

          {/* Hero Title */}
          <motion.h1
            variants={fadeInUp}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            className="text-6xl md:text-8xl font-bold mb-6 tracking-tighter"
          >
            <span className="bg-gradient-to-r from-white via-zinc-300 to-blue-500 bg-clip-text text-transparent">
              GATeR
            </span>
            <br />
            <span className="text-white">Intelligent Test Repair</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeInUp}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
            className="text-xl md:text-2xl text-zinc-400 mb-12 leading-relaxed max-w-3xl mx-auto"
          >
            GATeR provides a complete toolkit for understanding your codebase and fixing failing tests automatically.
            <span className="text-blue-400"> RAG-powered, context-aware, and hallucination-free.</span>
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeInUp}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.button
              onClick={() => signIn('github')}
              className="group flex items-center justify-center gap-3 bg-blue-600 text-white font-bold py-4 px-8 rounded-xl hover:bg-blue-700 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <GithubIcon className="w-5 h-5" />
              Start Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
            
            <motion.a
              href="#how-it-works"
              className="flex items-center justify-center gap-2 border border-zinc-600 text-zinc-300 font-bold py-4 px-8 rounded-xl hover:border-zinc-400 hover:bg-zinc-900/50 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Learn More
              <ChevronRight className="w-5 h-5" />
            </motion.a>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={fadeInUp}
            className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto"
          >
            {[
              { label: 'Success Rate', value: '99%' },
              { label: 'Avg Response', value: '<2s' },
              { label: 'Tests Fixed', value: '10K+' }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold text-blue-500 mb-1">{stat.value}</div>
                <div className="text-sm text-zinc-500 font-mono">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <AnimatedSection id="features" className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            variants={fadeInUp} 
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-4 tracking-tighter">
              Powerful Features
            </h2>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              Everything you need to understand, analyze, and repair your codebase
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            className="grid md:grid-cols-2 gap-6"
          >
            {features.map((feature, i) => (
              <FeatureCard key={i} {...feature} delay={i * 0.1} />
            ))}
          </motion.div>
        </div>
      </AnimatedSection>

      {/* Pipeline Section */}
      <AnimatedSection id="how-it-works" className="relative py-32 px-6 bg-zinc-950/30 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            variants={fadeInUp} 
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-4 tracking-tighter">
              How It Works
            </h2>
            <p className="text-xl text-zinc-400">
              Six-stage pipeline from repository to repair
            </p>
          </motion.div>

          {/* Central vertical line container */}
          <div className="relative">
            {/* Vertical central line - more subdued colors */}
            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-600 via-blue-500 to-blue-600 transform -translate-x-1/2 rounded-full shadow-lg shadow-blue-600/30" />
            
            {/* Connection dots on the line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 top-0 bottom-0 flex flex-col justify-around py-12">
              {pipelineSteps.map((_, i) => (
                <div key={i} className="w-3 h-3 bg-blue-400 rounded-full border-2 border-zinc-900 shadow-lg shadow-blue-600/30" />
              ))}
            </div>

            {/* Pipeline nodes - alternating left/right */}
            <div className="relative space-y-16 py-12">
              {pipelineSteps.map((step, i) => (
                <PipelineNode
                  key={i}
                  step={i + 1}
                  title={step.title}
                  icon={step.icon}
                  description={step.description}
                  isLast={i === pipelineSteps.length - 1}
                  isLeft={i % 2 === 0}
                />
              ))}
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* Pricing Section */}
      <AnimatedSection id="pricing" className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            variants={fadeInUp} 
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-4 tracking-tighter">
              Choose Your Plan
            </h2>
            <p className="text-xl text-zinc-400">
              Start free, scale as you grow
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto"
          >
            {pricingTiers.map((tier, i) => (
              <PricingTier key={i} {...tier} />
            ))}
          </motion.div>
        </div>
      </AnimatedSection>

      {/* About Section */}
      <AnimatedSection id="about" className="relative py-20 px-6 bg-zinc-950/30">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            variants={fadeInUp} 
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-4 tracking-tighter">
              About the Project
            </h2>
            <p className="text-xl text-zinc-400 max-w-3xl mx-auto">
              GATeR is a Final Year Project developed at NUCES Islamabad, 
              combining graph neural networks, vector embeddings, and LLMs 
              to revolutionize automated test repair.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {team.map((member, i) => (
              <motion.div
                key={i}
                variants={scaleIn}
                transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.1 }}
                className="bg-zinc-950/50 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-6 text-center hover:border-blue-600/50 transition-all duration-300"
                whileHover={{ y: -4 }}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-500 rounded-full mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-1">{member.name}</h3>
                <p className="text-sm text-blue-400 mb-2">{member.role}</p>
                <p className="text-xs text-zinc-500">{member.university}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </AnimatedSection>

      {/* Footer */}
      <footer className="relative border-t border-zinc-800/50 py-12 px-6 mt-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Database className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold">GATeR</span>
              </div>
              <p className="text-sm text-zinc-400">
                Graph-Augmented Test Repair powered by AI
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Research</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-white transition-colors">License</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-zinc-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">
              © 2026 GATeR. All rights reserved.
            </p>
            
            <div className="flex items-center gap-4">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">
                <GithubIcon className="w-5 h-5" />
              </a>
              <a href="#" className="text-zinc-400 hover:text-white transition-colors">
                <LinkedinIcon className="w-5 h-5" />
              </a>
              <a href="#" className="text-zinc-400 hover:text-white transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}