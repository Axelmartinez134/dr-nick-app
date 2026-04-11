"use client";

import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Link, Sparkles, SlidersHorizontal, ArrowRight, ArrowDown } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

// Utility for merging tailwind classes
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// ==== GLOBAL NOISE ====
const NoiseOverlay = () => (
  <svg className="noise-overlay" viewBox="0 0 100% 100%" xmlns="http://www.w3.org/2000/svg">
    <filter id="noiseFilter">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
    </filter>
    <rect width="100%" height="100%" filter="url(#noiseFilter)" />
  </svg>
);

// ==== NAVBAR ====
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        'fixed top-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-5xl transition-all duration-300 ease-out flex items-center justify-between px-6 py-3 rounded-full',
        scrolled
          ? 'bg-white/70 backdrop-blur-xl border border-black/5 shadow-lg text-black'
          : 'bg-transparent text-white'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-space-grotesk font-bold text-xl tracking-tight">ViralCarousels</span>
      </div>

      <div className="hidden md:flex items-center gap-8 font-inter text-sm font-medium">
        <a href="#features" className={cn('transition-colors', scrolled ? 'hover:text-black/70' : 'hover:text-white/70')}>Features</a>
        <a href="#how-it-works" className={cn('transition-colors', scrolled ? 'hover:text-black/70' : 'hover:text-white/70')}>How It Works</a>
        <a href="#pricing" className={cn('transition-colors', scrolled ? 'hover:text-black/70' : 'hover:text-white/70')}>Pricing</a>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-electric-coral animate-pulse" />
          <span className="font-space-mono text-xs uppercase tracking-wider opacity-70">Invite-Only</span>
        </div>
        <button className="magnetic-btn bg-electric-coral text-void px-5 py-2.5 rounded-full font-inter font-medium text-sm">
          <span>Join the Beta</span>
        </button>
      </div>
    </nav>
  );
};

// ==== HERO SECTION ====
const HeroSection = () => {
  const sectionRef = useRef(null);
  const textRef = useRef(null);
  const mockupRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Stagger text elements
      gsap.from('.hero-text-el', {
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out',
        delay: 0.2,
      });

      // Mockup fade in
      gsap.from(mockupRef.current, {
        x: 40,
        scale: 0.95,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        delay: 0.6,
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative w-full h-[100dvh] flex items-center overflow-hidden bg-void">
      {/* Background Image & Gradients */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop"
          alt="Dark creative workspace"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-void via-void/80 to-transparent w-full lg:w-3/4" />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/50 to-transparent h-full" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row justify-between items-center gap-12">
        {/* Left Content */}
        <div ref={textRef} className="max-w-3xl flex flex-col items-start w-full lg:w-2/3">
          {/* Eyebrow */}
          <div className="hero-text-el flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-electric-coral/30 bg-white/5 backdrop-blur-md relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-electric-coral/20 to-ultraviolet/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-electric-coral animate-pulse" />
            <span className="font-space-mono text-xs font-bold uppercase tracking-widest text-white/90">
              Invite-Only Beta — Limited Spots
            </span>
          </div>

          {/* Headline */}
          <h1 className="flex flex-col gap-0 mb-6 leading-[0.9]">
            <span className="hero-text-el font-space-grotesk font-bold text-[3rem] sm:text-[4rem] lg:text-[4.5rem] text-white tracking-tight">
              You already have the
            </span>
            <span className="hero-text-el font-instrument-serif italic font-normal text-[4.5rem] sm:text-[6rem] lg:text-[7rem] text-electric-coral tracking-tight -mt-2">
              content.
            </span>
            <span className="hero-text-el font-space-grotesk font-normal text-xl sm:text-2xl lg:text-[1.75rem] text-white/70 mt-4 leading-tight">
              We turn it into carousels that go viral.
            </span>
          </h1>

          {/* Subline */}
          <p className="hero-text-el font-inter text-lg sm:text-xl text-white/50 max-w-xl mb-10 leading-relaxed font-light">
            Paste any link. AI builds the carousel. You refine it with your taste. Post daily without losing a beat.
          </p>

          {/* CTA Cluster */}
          <div className="hero-text-el flex items-center gap-6">
            <button className="magnetic-btn bg-electric-coral hover:bg-electric-coral/90 text-void px-8 py-4 rounded-full font-inter font-semibold text-[15px] flex items-center gap-2">
              <span>Join the Beta</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a href="#how-it-works" className="group flex items-center gap-2 text-white/60 hover:text-white transition-colors font-inter text-[15px] font-medium">
              <span className="relative">
                See how it works
                <span className="absolute left-0 -bottom-1 w-0 h-[1px] bg-white transition-all duration-300 group-hover:w-full" />
              </span>
              <ArrowDown className="w-4 h-4 transition-transform group-hover:translate-y-1" />
            </a>
          </div>
        </div>

        {/* Right Content - Mockup */}
        <div ref={mockupRef} className="hidden lg:block w-1/3 relative perspective-1000">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
};

// ==== HERO MOCKUP (Mini Carousel Preview) ====
const HeroMockup = () => {
  const [activeSlide, setActiveSlide] = useState(0);
  const slides = [
    { bg: 'bg-void', border: 'border-white/10', title: 'Why 90% of creators fail' },
    { bg: 'bg-[#1A1A1A]', border: 'border-electric-coral/20', title: 'They ignore distribution.' },
    { bg: 'bg-[#0F0F1A]', border: 'border-ultraviolet/20', title: 'Build a system today.' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="w-[300px] h-[600px] rounded-[3rem] p-3 bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl relative rotate-[-2deg] hover:rotate-0 transition-transform duration-700 ease-out flex flex-col justify-end xl:w-[320px] xl:h-[640px]">
      {/* Phone Notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-void rounded-b-3xl" />

      {/* Screen Area */}
      <div className="w-full h-full bg-black rounded-[2.2rem] overflow-hidden relative border border-white/5">

        {/* Slides Track */}
        <div
          className="flex h-full w-full transition-transform duration-700 cubic-bezier-spring"
          style={{ transform: `translateX(-${activeSlide * 100}%)`, transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {slides.map((slide, idx) => (
            <div key={idx} className={cn('w-full h-full flex-shrink-0 p-8 flex flex-col justify-center relative border', slide.bg, slide.border)}>
              {/* Fake UI header inside post */}
              <div className="absolute top-6 left-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10" />
                <div className="w-24 h-2 rounded bg-white/10" />
              </div>

              <h3 className="font-space-grotesk font-bold text-3xl text-white leading-tight">
                {slide.title}
              </h3>

              <div className="absolute bottom-6 left-6 flex gap-1.5">
                {slides.map((_, dotIdx) => (
                  <div key={dotIdx} className={cn("h-1.5 rounded-full transition-all duration-300", idx === dotIdx ? "w-6 bg-white" : "w-1.5 bg-white/30")} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==== PROBLEM SECTION ====
// Simple count up hook
const useCountUp = (end, duration = 2000, start = 0) => {
  const [count, setCount] = useState(start);
  const countRef = useRef(start);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let startTime;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      const currentCount = Math.floor(start + (end - start) * ease);

      if (currentCount !== countRef.current) {
        countRef.current = currentCount;
        setCount(currentCount);
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    if (isVisible) {
      animationFrame = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, start, isVisible]);

  return { count, setIsVisible };
};

const ProblemSection = () => {
  const sectionRef = useRef(null);

  const { count: count1, setIsVisible: setVis1 } = useCountUp(73, 2000);
  const { count: count2, setIsVisible: setVis2 } = useCountUp(42, 2500); // We'll render as 4.2
  const { count: count3, setIsVisible: setVis3 } = useCountUp(4, 1500, 1);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Text reveal
      gsap.from('.problem-text', {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
        },
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out'
      });

      // Trigger counters
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 75%',
        onEnter: () => {
          setVis1(true);
          setVis2(true);
          setVis3(true);
        }
      });
    }, sectionRef);
    return () => ctx.revert();
  }, [setVis1, setVis2, setVis3]);

  return (
    <section ref={sectionRef} id="problem" className="w-full bg-cloud py-32 px-6 flex flex-col items-center justify-center text-center">
      <div className="max-w-4xl mx-auto">
        <div className="problem-text mb-6">
          <span className="font-space-mono text-xs uppercase tracking-[0.2em] text-slate font-bold">
            The Problem
          </span>
        </div>

        <h2 className="problem-text font-space-grotesk font-bold text-4xl md:text-[3rem] text-charcoal leading-tight mb-8 tracking-tight">
          Your best content is trapped in your head.
        </h2>

        <p className="problem-text font-inter text-lg md:text-xl text-charcoal/80 leading-relaxed max-w-3xl mx-auto mb-16">
          You posted a reel that got 500K views. Then went silent for two weeks. Your competitors post every single day — not because they have more ideas, but because they have a system. You don't have a content problem. You have a <span className="font-instrument-serif italic text-electric-coral text-2xl md:text-3xl">multiplication</span> problem.
        </p>

        {/* Stat Strip */}
        <div className="problem-text flex flex-col md:flex-row items-center justify-center gap-8 md:gap-0 border-y border-black/5 py-8">
          <div className="flex-1 px-8 flex flex-col items-center gap-2">
            <div className="font-space-mono text-4xl text-charcoal font-bold tracking-tighter">
              {count1}%
            </div>
            <div className="font-inter text-sm text-slate">
              of coaches post less than 3x/week
            </div>
          </div>
          <div className="hidden md:block w-px h-16 bg-black/5" />
          <div className="flex-1 px-8 flex flex-col items-center gap-2">
            <div className="font-space-mono text-4xl text-charcoal font-bold tracking-tighter">
              {count2 / 10}x
            </div>
            <div className="font-inter text-sm text-slate">
              faster growth for consistent posters
            </div>
          </div>
          <div className="hidden md:block w-px h-16 bg-black/5" />
          <div className="flex-1 px-8 flex flex-col items-center gap-2">
            <div className="font-space-mono text-4xl text-electric-coral font-bold tracking-tighter">
              1 <span className="text-2xl text-charcoal/30 mx-1">→</span> {count3}
            </div>
            <div className="font-inter text-sm text-slate">
              carousels from a single idea
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==== FEATURES SECTION ====
const FeaturesSection = () => {
  const sectionRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.feature-card', {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
        },
        y: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: 'power3.out'
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="features" className="w-full bg-cloud py-24 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <span className="font-space-mono text-xs uppercase tracking-[0.2em] text-slate font-bold block mb-4">
            Features
          </span>
          <h2 className="font-space-grotesk font-bold text-4xl md:text-5xl text-charcoal tracking-tight flex flex-col items-center gap-2">
            <span>Not another design tool.</span>
            <span className="font-instrument-serif italic font-normal text-electric-coral text-5xl md:text-6xl">
              A content engine.
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard1 />
          <FeatureCard2 />
          <FeatureCard3 />
        </div>
      </div>
    </section>
  );
};

// Card 1: Carousel Preview
const FeatureCard1 = () => {
  return (
    <div className="feature-card bg-white rounded-[2rem] shadow-sm border border-black/5 p-8 flex flex-col relative overflow-hidden group">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-electric-coral animate-pulse" />
        <span className="font-space-mono text-xs uppercase tracking-wider text-charcoal font-bold">Live Preview</span>
      </div>
      <h3 className="font-space-grotesk font-bold text-2xl text-charcoal leading-tight mb-3">See it before you post it.</h3>
      <p className="font-inter text-slate text-sm leading-relaxed mb-10">
        AI generates carousel slides from any link. Watch them come to life in real-time.
      </p>

      {/* Demo UI */}
      <div className="mt-auto flex justify-center">
        <div className="w-[180px] h-[360px] bg-void rounded-[2rem] p-2 relative shadow-xl overflow-hidden group-hover:-translate-y-2 transition-transform duration-500">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-4 bg-white rounded-b-xl z-10" />
          <div className="w-full h-full bg-black rounded-[1.6rem] overflow-hidden relative border border-white/10">
            {/* Swiping slides track - simple CSS animation for demo */}
            <div className="flex h-full animate-[swipe_10s_cubic-bezier(0.34,1.56,0.64,1)_infinite]">
              <div className="w-full h-full flex-shrink-0 bg-gradient-to-br from-[#2A0800] to-void p-4 flex flex-col justify-center">
                <div className="w-12 h-2 bg-electric-coral/50 rounded mb-4" />
                <div className="w-full h-4 bg-white/20 rounded mb-2" />
                <div className="w-3/4 h-4 bg-white/20 rounded" />
              </div>
              <div className="w-full h-full flex-shrink-0 bg-gradient-to-br from-[#100D2A] to-void p-4 flex flex-col justify-center">
                <div className="w-12 h-2 bg-ultraviolet/50 rounded mb-4" />
                <div className="w-full h-4 bg-white/20 rounded mb-2" />
                <div className="w-5/6 h-4 bg-white/20 rounded" />
              </div>
              <div className="w-full h-full flex-shrink-0 bg-gradient-to-br from-[#2A0800] to-void p-4 flex flex-col justify-center">
                <div className="w-12 h-2 bg-electric-coral/50 rounded mb-4" />
                <div className="w-full h-4 bg-white/20 rounded mb-2" />
                <div className="w-2/3 h-4 bg-white/20 rounded" />
              </div>
            </div>

            <div className="absolute bottom-4 left-0 w-full flex justify-center gap-1">
              <div className="w-4 h-1 rounded-full bg-electric-coral" />
              <div className="w-1 h-1 rounded-full bg-white/30" />
              <div className="w-1 h-1 rounded-full bg-white/30" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Card 2: Growth Counter
const FeatureCard2 = () => {
  const [key, setKey] = useState(0);

  // Re-run animation periodically
  useEffect(() => {
    const timer = setInterval(() => setKey(k => k + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="feature-card bg-white rounded-[2rem] shadow-sm border border-black/5 p-8 flex flex-col relative overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
        <span className="font-space-mono text-xs uppercase tracking-wider text-charcoal font-bold">Real Results</span>
      </div>
      <h3 className="font-space-grotesk font-bold text-2xl text-charcoal leading-tight mb-3">Growth you can measure.</h3>
      <p className="font-inter text-slate text-sm leading-relaxed mb-10">
        Dr. Nick went from 50K to 250K followers. Consistent carousels were the difference.
      </p>

      {/* Demo UI */}
      <div key={key} className="mt-auto flex flex-col gap-4 bg-cloud rounded-2xl p-6 border border-black/5">
        <div>
          <div className="font-inter outline-none text-xs text-slate font-medium mb-1">Before ViralCarousels</div>
          <div className="flex items-end gap-3">
            <div className="font-space-mono text-3xl text-slate font-bold tracking-tight">
              <Counter end={50000} start={48200} duration={8000} />
            </div>
            <div className="text-[10px] font-mono text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100 mb-1">↓ 2.3% eng</div>
          </div>
        </div>
        <div className="w-full h-px bg-black/5" />
        <div>
          <div className="font-inter outline-none text-xs text-electric-coral font-medium mb-1">After ViralCarousels</div>
          <div className="flex items-end gap-3">
            <div className="font-space-mono text-3xl text-charcoal font-bold tracking-tight">
              <Counter end={250000} start={50000} duration={6000} fast />
            </div>
            <div className="text-[10px] font-mono text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100 mb-1">↑ 847% growth</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Counter = ({ start, end, duration, fast }) => {
  const [count, setCount] = useState(start);

  useEffect(() => {
    let startTimestamp = null;
    let frameId;
    const animate = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // Different easing based on fast flag
      const ease = fast
        ? 1 - Math.pow(1 - progress, 3) // cubic out for fast acceleration
        : progress; // linear for slow crawl

      setCount(Math.floor(start + (end - start) * ease));
      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [start, end, duration, fast]);

  return <>{count.toLocaleString()}</>;
};

// Card 3: Content Calendar
const FeatureCard3 = () => {
  const [cells, setCells] = useState(Array(14).fill(false));
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let timers = [];
    const runSequence = () => {
      setCells(Array(14).fill(false));
      setComplete(false);

      for (let i = 0; i < 14; i++) {
        // slight staggering
        timers.push(setTimeout(() => {
          setCells(c => {
            const next = [...c];
            next[i] = true;
            return next;
          });
        }, i * (Math.random() * 200 + 100)));
      }

      timers.push(setTimeout(() => {
        setComplete(true);
      }, 14 * 300));

      timers.push(setTimeout(() => {
        runSequence(); // loop
      }, 8000));
    };

    runSequence();

    return () => timers.forEach(clearTimeout);
  }, []);

  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="feature-card bg-white rounded-[2rem] shadow-sm border border-black/5 p-8 flex flex-col relative overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-ultraviolet animate-pulse" />
        <span className="font-space-mono text-xs uppercase tracking-wider text-charcoal font-bold">Smart Scheduling</span>
      </div>
      <h3 className="font-space-grotesk font-bold text-2xl text-charcoal leading-tight mb-3">A full week in 10 minutes.</h3>
      <p className="font-inter text-slate text-sm leading-relaxed mb-10">
        Paste 2 links. Get 8 carousels. Your entire week is done.
      </p>

      {/* Demo UI */}
      <div className="mt-auto w-full bg-cloud border border-black/5 rounded-2xl p-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {days.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-mono text-slate/60">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 gap-y-2">
          {cells.map((isFilled, i) => (
            <div key={i} className="aspect-square rounded-[4px] bg-black/5 relative overflow-hidden flex items-center justify-center">
              {isFilled && (
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br animate-pop-in",
                  i % 3 === 0 ? "from-ultraviolet to-[#5040CD]" : "from-electric-coral to-[#D94100]"
                )}>
                  {/* Fake tiny thumbnail lines */}
                  <div className="w-1/2 h-0.5 bg-white/40 absolute top-1 left-0.5 rounded" />
                  <div className="w-3/4 h-0.5 bg-white/30 absolute top-2 left-0.5 rounded" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="h-6 mt-3 flex items-center justify-center">
          {complete && (
            <div className="flex items-center gap-1.5 text-[11px] font-inter font-medium text-charcoal animate-fade-in">
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Week Scheduled
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==== HOW IT WORKS SECTION ====
const HowItWorksSection = () => {
  const sectionRef = useRef(null);
  const lineRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Draw SVG line
      if (lineRef.current) {
        const length = lineRef.current.getTotalLength();
        gsap.set(lineRef.current, { strokeDasharray: length, strokeDashoffset: length });

        gsap.to(lineRef.current, {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 50%',
            end: 'bottom 80%',
            scrub: 1,
          }
        });
      }

      // Step reveals
      gsap.from('.step-card', {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 60%',
        },
        y: 40,
        opacity: 0,
        duration: 0.8,
        stagger: 0.3,
        ease: 'power3.out'
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="how-it-works" className="w-full bg-void py-32 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-24">
          <span className="font-space-mono text-xs uppercase tracking-[0.2em] text-electric-coral font-bold block mb-4">
            How It Works
          </span>
          <h2 className="font-space-grotesk font-bold text-4xl md:text-5xl text-white tracking-tight flex flex-col items-center gap-2">
            <span>From link to carousel in</span>
            <span className="font-instrument-serif italic font-normal text-electric-coral text-5xl md:text-6xl">
              three steps.
            </span>
          </h2>
        </div>

        <div className="relative">
          {/* Desktop connecting line */}
          <div className="hidden md:block absolute top-[60px] left-[16%] right-[16%] h-[2px] z-0">
            <svg width="100%" height="100%" preserveAspectRatio="none">
              <line
                ref={lineRef}
                x1="0" y1="0" x2="100%" y2="0"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="8 8"
                className="text-white/20"
              />
            </svg>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
            {/* Step 1 */}
            <div className="step-card flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-electric-coral/10 border border-electric-coral/20 flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 bg-electric-coral/5 blur-xl rounded-full" />
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center relative z-10">
                  <span className="font-space-mono text-electric-coral font-bold hidden">1</span>
                  <svg className="w-6 h-6 text-electric-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
              </div>
              <h3 className="font-space-grotesk font-bold text-2xl text-white mb-4">Paste any link</h3>
              <p className="font-inter text-white/60 text-[15px] leading-relaxed max-w-sm">
                Instagram reel, YouTube video, tweet, blog post. If it's your content — or your competitor's best content — it works.
              </p>
            </div>

            {/* Step 2 */}
            <div className="step-card flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-ultraviolet/10 border border-ultraviolet/20 flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 bg-ultraviolet/5 blur-xl rounded-full" />
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center relative z-10">
                  <span className="font-space-mono text-ultraviolet font-bold hidden">2</span>
                  <svg className="w-6 h-6 text-ultraviolet" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
              </div>
              <h3 className="font-space-grotesk font-bold text-2xl text-white mb-4">AI generates the carousels</h3>
              <p className="font-inter text-white/60 text-[15px] leading-relaxed max-w-sm">
                Headlines, body copy, images, layouts — all generated. Not templates. Original carousels built from YOUR content and voice.
              </p>
            </div>

            {/* Step 3 */}
            <div className="step-card flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-electric-coral/10 border border-electric-coral/20 flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 bg-electric-coral/5 blur-xl rounded-full" />
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center relative z-10">
                  <span className="font-space-mono text-electric-coral font-bold hidden">3</span>
                  <svg className="w-6 h-6 text-electric-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
              </div>
              <h3 className="font-space-grotesk font-bold text-2xl text-white mb-4">Refine with your taste</h3>
              <p className="font-inter text-white/60 text-[15px] leading-relaxed max-w-sm">
                Adjust any slide. Rewrite with AI. Swap images. Then post — or schedule your whole week in one sitting.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==== SOCIAL PROOF SECTION ====
const SocialProofSection = () => {
  const sectionRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.proof-left', {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
        },
        x: -50,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
      });

      gsap.from('.proof-right-card', {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
        },
        x: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out'
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="social-proof" className="w-full bg-cloud py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <span className="font-space-mono text-xs uppercase tracking-[0.2em] text-slate font-bold block mb-4">
            Results
          </span>
          <h2 className="font-space-grotesk font-bold text-4xl md:text-[3rem] text-charcoal tracking-tight flex flex-col md:flex-row gap-2">
            <span>Don't take our word for it.</span>
            <span className="font-instrument-serif italic font-normal text-electric-coral text-[3rem]">
              Take theirs.
            </span>
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column - Featured */}
          <div className="proof-left lg:w-[60%] bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-black/5 flex flex-col justify-between">
            <div className="flex flex-col gap-8 mb-12">
              <div className="w-full aspect-video bg-black/5 rounded-2xl flex items-center justify-center border border-black/5 overflow-hidden relative group">
                {/* Visual placeholder mimicking a tweet/post screenshot */}
                <div className="w-full max-w-sm bg-white rounded-xl shadow-md p-4 flex flex-col gap-3 scale-95 group-hover:scale-100 transition-transform duration-500">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate/20" />
                    <div>
                      <div className="w-20 h-3 bg-slate/20 rounded mb-1" />
                      <div className="w-16 h-2 bg-slate/10 rounded" />
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate/20 rounded" />
                  <div className="w-5/6 h-3 bg-slate/20 rounded" />
                  <div className="w-full h-32 bg-slate/10 rounded-lg mt-2" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent pointer-events-none" />
              </div>
              <div className="font-instrument-serif italic text-3xl md:text-4xl text-charcoal leading-tight max-w-lg">
                "Carousel content changed everything for my practice."
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-8 border-t border-black/5">
              <div>
                <div className="font-space-grotesk font-bold text-xl text-charcoal mb-1">Dr. Nick</div>
                <div className="font-inter text-slate text-sm">Health & Wellness Coach</div>
              </div>
              <div className="text-right">
                <div className="font-space-mono text-3xl text-charcoal font-bold tracking-tight mb-1">
                  50K <span className="text-electric-coral mx-1">→</span> 250K
                </div>
                <div className="font-inter text-slate text-sm">followers in 8 months</div>
              </div>
            </div>
          </div>

          {/* Right Column - Stack */}
          <div className="lg:w-[40%] flex flex-col gap-6">
            <div className="proof-right-card bg-white rounded-3xl p-8 shadow-sm border border-black/5 flex-1 flex flex-col justify-center">
              <div className="font-space-mono text-4xl text-charcoal font-bold tracking-tighter mb-2">
                4x
              </div>
              <div className="font-inter text-slate">
                weekly posting frequency
              </div>
            </div>

            <div className="proof-right-card bg-white rounded-3xl p-8 shadow-sm border border-black/5 flex-1 flex flex-col justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-electric-coral/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="font-space-mono text-4xl text-electric-coral font-bold tracking-tighter mb-2">
                312%
              </div>
              <div className="font-inter text-slate">
                increase in engagement
              </div>
            </div>

            <div className="proof-right-card bg-white rounded-3xl p-8 shadow-sm border border-black/5 flex-1 flex flex-col justify-center">
              <div className="font-space-mono text-4xl text-charcoal font-bold tracking-tighter mb-2">
                2 <span className="text-2xl text-slate font-normal">hrs/wk</span>
              </div>
              <div className="font-inter text-slate">
                saved on content creation
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==== PHILOSOPHY SECTION ====
const PhilosophySection = () => {
  const sectionRef = useRef(null);
  const textureRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Parallax texture
      gsap.to(textureRef.current, {
        yPercent: 30, // Move texture down as user scrolls down
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        }
      });

      // Split text reveal logic (simulated with line-by-line GSAP)
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 50%',
          end: 'bottom 80%',
          scrub: 1,
        }
      });

      tl.from('.phil-line-1, .phil-line-2', { opacity: 0, y: 30, stagger: 0.1, duration: 1 })
        .from('.phil-line-3', { opacity: 0, y: 30, duration: 1 }, "+=0.2")
        .from('.phil-line-4', { opacity: 0, y: 30, duration: 1, color: '#FFFFFF' }, "+=0.1") // Reveals red at the end
        .from('.phil-sub', { opacity: 0, duration: 1 });

    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="philosophy" className="w-full bg-void py-48 px-6 relative overflow-hidden flex items-center justify-center min-h-screen">
      {/* Texture Background */}
      <div
        ref={textureRef}
        className="absolute inset-x-0 -top-[20%] h-[140%] z-0 opacity-20 pointer-events-none mix-blend-screen"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'grayscale(100%) contrast(150%)'
        }}
      />
      <div className="absolute inset-0 bg-void/80 z-0" /> {/* Darkening overlay */}

      <div className="max-w-5xl mx-auto relative z-10 flex flex-col items-center text-center">
        <h2 className="flex flex-col gap-1 md:gap-2 mb-16 w-full items-center">
          <span className="phil-line-1 font-space-grotesk font-normal text-3xl md:text-[2.5rem] tracking-tight text-white/40">
            Other tools help you
          </span>
          <span className="phil-line-2 font-instrument-serif italic font-normal text-6xl md:text-[5rem] tracking-tight text-white/60 mb-8 md:mb-12">
            design carousels.
          </span>
          <span className="phil-line-3 font-space-grotesk font-normal text-3xl md:text-[2.5rem] tracking-tight text-white/40">
            We make sure you
          </span>
          <span className="phil-line-4 font-instrument-serif italic font-normal text-6xl md:text-[5rem] tracking-tight text-electric-coral">
            never run out of content.
          </span>
        </h2>

        <p className="phil-sub font-inter text-lg md:text-xl text-white/40 leading-relaxed max-w-[600px] text-center font-light">
          You don't need another Canva template. You need a system that turns everything you've already said into content that posts itself.
        </p>
      </div>
    </section>
  );
};

// ==== PROTOCOL SECTION ====
const ProtocolSection = () => {
  const containerRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray('.protocol-card');

      cards.forEach((card, index) => {
        if (index === cards.length - 1) return; // Last card doesn't pin/scale

        // When this card hits top, it pins. 
        // Then as the *next* card comes up, this card scales down and blurs.
        const nextCard = cards[index + 1];

        ScrollTrigger.create({
          trigger: card,
          start: 'top top',
          endTrigger: nextCard,
          end: 'top top',
          pin: true,
          pinSpacing: false,
        });

        gsap.to(card, {
          scale: 0.92,
          opacity: 0.4,
          filter: 'blur(16px)',
          ease: 'none',
          scrollTrigger: {
            trigger: nextCard,
            start: 'top bottom',
            end: 'top top',
            scrub: true,
          }
        });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} id="protocol" className="w-full bg-void px-4 py-12 pb-32 flex flex-col items-center">
      {/* Container for cards to enable sticky positioning correctly within the flow */}
      <div className="w-full max-w-6xl relative flex flex-col gap-8 md:gap-0">

        {/* Card 1 */}
        <div className="protocol-card w-full min-h-[90vh] md:min-h-screen rounded-[2.5rem] bg-white p-8 md:p-16 flex flex-col md:flex-row items-center gap-12 sticky top-0 shadow-2xl">
          <div className="flex-1">
            <div className="font-space-mono text-xs uppercase tracking-widest text-electric-coral font-bold mb-6">Repurpose</div>
            <h2 className="font-space-grotesk font-bold text-4xl md:text-5xl text-charcoal leading-tight mb-6">
              One reel becomes four carousels.
            </h2>
            <p className="font-inter text-lg text-slate leading-relaxed">
              Paste a link to any social post — yours or your competitor's. AI extracts the core ideas, hooks, and structure, then generates multiple unique carousel angles from a single source.
            </p>
          </div>
          <div className="flex-1 w-full h-full min-h-[400px] flex items-center justify-center bg-cloud rounded-[2rem] p-6 relative">
            {/* Simple splitting animation artifact */}
            <div className="relative w-40 h-64 flex items-center justify-center">
              <div className="absolute inset-0 bg-charcoal rounded-xl shadow-xl flex items-center justify-center text-white font-space-grotesk font-bold text-center p-4 z-10 animate-[bounce_5s_infinite]">
                Your Reel
              </div>
              <div className="absolute w-32 h-48 bg-electric-coral/20 rounded-xl border border-electric-coral/50 -translate-x-12 -translate-y-12 rotate-[-10deg] animate-[pulse_5s_infinite]" />
              <div className="absolute w-32 h-48 bg-ultraviolet/20 rounded-xl border border-ultraviolet/50 translate-x-16 -translate-y-8 rotate-[5deg] animate-[pulse_5s_infinite_0.5s]" />
              <div className="absolute w-32 h-48 bg-electric-coral/20 rounded-xl border border-electric-coral/50 -translate-x-10 translate-y-16 rotate-[-5deg] animate-[pulse_5s_infinite_1s]" />
              <div className="absolute w-32 h-48 bg-ultraviolet/20 rounded-xl border border-ultraviolet/50 translate-x-12 translate-y-12 rotate-[15deg] animate-[pulse_5s_infinite_1.5s]" />
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="protocol-card w-full min-h-[90vh] md:min-h-screen rounded-[2.5rem] bg-void border border-white/10 p-8 md:p-16 flex flex-col md:flex-row items-center gap-12 sticky top-0 shadow-2xl">
          <div className="flex-1">
            <div className="font-space-mono text-xs uppercase tracking-widest text-ultraviolet font-bold mb-6">Generate</div>
            <h2 className="font-space-grotesk font-bold text-4xl md:text-5xl text-white leading-tight mb-6">
              Images and copy that actually fit.
            </h2>
            <p className="font-inter text-lg text-white/60 leading-relaxed">
              AI doesn't just write slides — it generates images and dynamically reflows text around them. Every carousel looks intentionally designed, not auto-generated.
            </p>
          </div>
          <div className="flex-1 w-full h-full min-h-[400px] flex items-center justify-center bg-[#1A1A1A] rounded-[2rem] p-6 relative overflow-hidden">
            {/* Simple reflow animation artifact */}
            <div className="w-full max-w-sm aspect-square bg-void border border-white/10 rounded-2xl relative p-6 flex flex-col justify-between">
              {/* Grid overlay */}
              <div className="absolute inset-0 border border-white/5 rounded-2xl pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '1rem 1rem' }} />

              <div className="w-full h-1/2 bg-ultraviolet/30 rounded-xl border border-ultraviolet/50 mb-4 animate-[pulse_4s_infinite]" />
              <div className="space-y-2 relative z-10">
                <div className="w-3/4 h-3 bg-white/40 rounded transition-all duration-1000" />
                <div className="w-full h-3 bg-white/40 rounded transition-all duration-1000 delay-100" />
                <div className="w-5/6 h-3 bg-white/40 rounded transition-all duration-1000 delay-200" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="protocol-card w-full min-h-[90vh] md:min-h-screen rounded-[2.5rem] bg-cloud border border-electric-coral/20 p-8 md:p-16 flex flex-col md:flex-row items-center gap-12 sticky top-0 shadow-2xl">
          <div className="flex-1">
            <div className="font-space-mono text-xs uppercase tracking-widest text-electric-coral font-bold mb-6">Refine</div>
            <h2 className="font-space-grotesk font-bold text-4xl md:text-5xl text-charcoal leading-tight mb-6">
              Your voice. Your vibe. Always.
            </h2>
            <p className="font-inter text-lg text-slate leading-relaxed">
              AI drafts it. You shape it. Rewrite any slide with a single prompt. Swap images. Adjust tone. The AI learns your style so every carousel sounds like you, not a robot.
            </p>
          </div>
          <div className="flex-1 w-full h-full min-h-[400px] flex items-center justify-center bg-white rounded-[2rem] shadow-sm border border-black/5 p-6 relative">
            <div className="w-full max-w-sm aspect-square bg-[#F4F4F4] rounded-2xl p-8 flex flex-col justify-center gap-4 relative">
              <div className="font-space-mono text-sm text-electric-coral mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                AI Rewrite
              </div>
              <div className="relative font-instrument-serif text-3xl md:text-4xl text-charcoal italic leading-tight">
                <span className="animate-[pulse_3s_infinite]">Stop posting random ideas.</span>
                <span className="inline-block w-1.5 h-8 bg-electric-coral ml-1 animate-pulse align-middle" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

// ==== PRICING SECTION ====
const PricingSection = () => {
  const sectionRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.pricing-card', {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
        },
        y: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out'
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="pricing" className="w-full bg-cloud py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <span className="font-space-mono text-xs uppercase tracking-[0.2em] text-slate font-bold block mb-4">
            Pricing
          </span>
          <h2 className="font-space-grotesk font-bold text-4xl md:text-5xl text-charcoal tracking-tight flex flex-col items-center gap-2 mb-4">
            <span>Simple pricing.</span>
            <span className="font-instrument-serif italic font-normal text-electric-coral text-5xl md:text-6xl">
              Serious results.
            </span>
          </h2>
          <p className="font-inter text-slate text-lg">
            Start with AI-powered carousels. Scale to fully managed content.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center max-w-6xl mx-auto">
          {/* Starter */}
          <div className="pricing-card bg-white rounded-[2rem] p-10 shadow-sm border border-black/5 flex flex-col h-full">
            <h3 className="font-space-grotesk font-bold text-2xl text-charcoal mb-2">Starter</h3>
            <div className="flex items-baseline gap-1 mb-8">
              <span className="font-space-grotesk font-black text-5xl text-charcoal">$49.99</span>
              <span className="font-inter text-slate">/mo</span>
            </div>

            <ul className="space-y-4 font-inter text-charcoal/80 mb-auto min-h-[220px]">
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-electric-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Paste any social media link
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-electric-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                AI-generated carousel content
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-electric-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Image generation + text adaptation
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-electric-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Taste-based refinement tools
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-electric-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Up to 20 carousels/month
              </li>
            </ul>

            <button className="w-full py-4 mt-8 rounded-full border-2 border-charcoal text-charcoal font-inter font-bold hover:bg-charcoal hover:text-white transition-colors duration-300">
              Join the Beta
            </button>
          </div>

          {/* Agency */}
          <div className="pricing-card bg-void rounded-[2.5rem] p-10 shadow-2xl relative md:scale-105 z-10 flex flex-col h-full">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-8 rounded-full bg-gradient-to-r from-electric-coral to-ultraviolet flex items-center justify-center font-space-mono text-xs font-bold uppercase tracking-wider text-white shadow-lg">
              Most Popular
            </div>

            <h3 className="font-space-grotesk font-bold text-2xl text-white mb-2">Agency</h3>
            <div className="flex items-baseline gap-1 mb-8">
              <span className="font-space-grotesk font-black text-6xl text-white">$250</span>
              <span className="font-inter text-white/60">/mo</span>
            </div>

            <ul className="space-y-4 font-inter text-white/90 mb-auto min-h-[220px]">
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-electric-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Everything in Starter
              </li>
              <li className="flex gap-3 text-white font-medium">
                <svg className="w-5 h-5 text-electric-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Unlimited carousels
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-electric-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Team access (up to 5 seats)
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-electric-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Priority AI generation queue
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-electric-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Advanced analytics dashboard
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-electric-coral shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Multi-brand support
              </li>
            </ul>

            <button className="magnetic-btn w-full py-4 mt-8 rounded-full bg-electric-coral text-void font-inter font-bold text-lg hover:bg-electric-coral/90 transition-colors shadow-[0_0_30px_rgba(255,77,0,0.3)] hover:shadow-[0_0_40px_rgba(255,77,0,0.5)]">
              <span>Join the Beta</span>
            </button>
          </div>

          {/* DFY */}
          <div className="pricing-card bg-white rounded-[2rem] p-10 shadow-sm border border-ultraviolet/20 flex flex-col h-full relative">
            <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-ultraviolet/10 text-ultraviolet font-space-mono text-[10px] font-bold uppercase tracking-wider">
              White Glove
            </div>

            <h3 className="font-space-grotesk font-bold text-2xl text-charcoal mb-2">Done For You</h3>
            <div className="flex items-baseline gap-1 mb-8">
              <span className="font-space-grotesk font-black text-5xl text-charcoal tracking-tight">Custom</span>
            </div>

            <ul className="space-y-4 font-inter text-charcoal/80 mb-auto min-h-[220px]">
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-ultraviolet shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Everything in Agency
              </li>
              <li className="flex gap-3 font-medium text-charcoal">
                <svg className="w-5 h-5 text-ultraviolet shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Dedicated content strategist
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-ultraviolet shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Full carousel creation + scheduling
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-ultraviolet shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Voice-matched writing
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-ultraviolet shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Monthly strategy calls
              </li>
              <li className="flex gap-3">
                <svg className="w-5 h-5 text-ultraviolet shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                We post for you
              </li>
            </ul>

            <button className="magnetic-btn w-full py-4 mt-8 rounded-full bg-ultraviolet text-white font-inter font-bold hover:bg-ultraviolet/90 transition-colors">
              <span>Book a Call</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

// ==== WAITLIST CAPTURE ====
const WaitlistSection = () => {
  const sectionRef = useRef(null);
  const cardRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(cardRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
        },
        y: 60,
        opacity: 0,
        duration: 1,
        ease: 'power3.out'
      });

      gsap.from('.form-el', {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 60%',
        },
        y: 20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power2.out',
        delay: 0.3
      });

      gsap.to('.submit-btn', {
        scale: 1.02,
        repeat: 1,
        yoyo: true,
        duration: 0.2,
        delay: 2,
        ease: 'sine.inOut',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 50%'
        }
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="w-full bg-void py-40 px-6 relative overflow-hidden flex flex-col items-center">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-electric-coral/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="text-center mb-16 relative z-10 w-full max-w-4xl px-4">
        <h2 className="font-space-grotesk font-bold text-4xl md:text-[3.5rem] tracking-tight text-white flex flex-col gap-1 mb-6">
          <span>The beta is</span>
          <span className="font-instrument-serif italic font-normal text-[4rem] md:text-[4.5rem] text-electric-coral leading-none">
            invite-only.
          </span>
        </h2>
        <p className="font-inter text-lg md:text-xl text-white/60 leading-relaxed max-w-2xl mx-auto">
          We're rolling out access in small cohorts to keep quality high. Drop your details and we'll let you know when it's your turn.
        </p>
      </div>

      <div ref={cardRef} className="w-full max-w-xl bg-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative z-10 mx-4">
        <form className="flex flex-col gap-6" onSubmit={e => e.preventDefault()}>
          <div className="form-el flex flex-col gap-2">
            <label className="font-inter font-medium text-sm text-charcoal/80 ml-5">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full px-5 py-4 bg-cloud border border-black/5 rounded-2xl font-inter text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-electric-coral/20 focus:border-electric-coral transition-all"
              required
            />
          </div>

          <div className="form-el flex flex-col gap-2">
            <label className="font-inter font-medium text-sm text-charcoal/80 ml-5">Social Profile</label>
            <input
              type="url"
              placeholder="Instagram, TikTok, YouTube, or X link"
              className="w-full px-5 py-4 bg-cloud border border-black/5 rounded-2xl font-inter text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-electric-coral/20 focus:border-electric-coral transition-all"
              required
            />
          </div>

          <div className="form-el flex flex-col gap-2">
            <label className="font-inter font-medium text-sm text-charcoal/80 ml-5">What would you use it for?</label>
            <textarea
              placeholder="Growing my coaching business, repurposing podcasts..."
              rows={3}
              className="w-full px-5 py-4 bg-cloud border border-black/5 rounded-2xl font-inter text-charcoal placeholder:text-slate focus:outline-none focus:ring-2 focus:ring-electric-coral/20 focus:border-electric-coral transition-all resize-none"
            />
          </div>

          <button className="form-el submit-btn magnetic-btn w-full py-5 rounded-full bg-electric-coral text-void font-inter font-bold text-lg hover:bg-electric-coral/90 transition-colors mt-2 flex items-center justify-center gap-2">
            <span>Request Access</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="form-el text-center mt-2 flex items-center justify-center gap-2">
            <span className="text-slate">🔒</span>
            <span className="font-inter text-sm text-slate">No spam. No sharing. Just early access.</span>
          </div>
        </form>
      </div>
    </section>
  );
};

// ==== FOOTER ====
const Footer = () => {
  return (
    <footer className="w-full bg-void pt-20 pb-8 px-6 border-t border-white/5 relative z-20">

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12 mb-16 px-4">
        {/* Brand */}
        <div className="flex-1 max-w-sm">
          <div className="font-space-grotesk font-bold text-2xl text-white tracking-tight mb-4">
            ViralCarousels
          </div>
          <p className="font-inter text-white/40 text-sm leading-relaxed">
            AI-native carousel creation for creators who refuse to be inconsistent.
          </p>
        </div>

        {/* Links */}
        <div className="flex-[2] flex flex-wrap gap-12 md:gap-24 md:justify-end">
          <div className="flex flex-col gap-4">
            <div className="font-space-mono text-xs uppercase tracking-widest text-white/40 font-bold mb-2">Product</div>
            <a href="#features" className="font-inter text-sm text-white/60 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="font-inter text-sm text-white/60 hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="font-inter text-sm text-white/60 hover:text-white transition-colors">Pricing</a>
          </div>

          <div className="flex flex-col gap-4">
            <div className="font-space-mono text-xs uppercase tracking-widest text-white/40 font-bold mb-2">Company</div>
            <a href="#" className="font-inter text-sm text-white/60 hover:text-white transition-colors">About</a>
            <a href="#" className="font-inter text-sm text-white/60 hover:text-white transition-colors">Contact</a>
            <a href="#" className="font-inter text-sm text-white/60 hover:text-white transition-colors">Privacy</a>
            <a href="#" className="font-inter text-sm text-white/60 hover:text-white transition-colors">Terms</a>
          </div>
        </div>

        {/* Status */}
        <div className="flex-1 flex flex-col md:items-end gap-2">
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/10 w-fit">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-[pulse_2s_infinite]" />
            <span className="font-space-mono text-xs text-white/80 uppercase tracking-widest">System Operational</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 px-4">
        <div className="font-inter text-xs text-white/30">
          © 2026 ViralCarousels. All rights reserved.
        </div>
        <div className="font-inter text-xs text-white/20 italic">
          Built for creators who move fast.
        </div>
      </div>
    </footer>
  );
};

export default function LandingClient() {
  return (
    <div className="relative min-h-screen selection:bg-electric-coral selection:text-void">
      <NoiseOverlay />
      <Navbar />
      <main>
        <HeroSection />
        <ProblemSection />
        <FeaturesSection />
        <HowItWorksSection />
        <SocialProofSection />
        <PhilosophySection />
        <ProtocolSection />
        <PricingSection />
        <WaitlistSection />
        <Footer />
      </main>
    </div>
  );
}
