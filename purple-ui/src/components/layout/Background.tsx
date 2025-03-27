
import React from 'react';

const Background: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base background color */}
      <div className="absolute inset-0 bg-dex-dark"></div>
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 grid-pattern opacity-30"></div>
      
      {/* Gradient mesh */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-40"></div>
      
      {/* Animated glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-dex-glow-purple blur-[150px] opacity-20 animate-float"></div>
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-dex-glow-blue blur-[120px] opacity-15 animate-float" style={{ animationDelay: '-3s' }}></div>
      
      {/* Animated lines */}
      <div className="hidden lg:block absolute top-1/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-dex-purple/30 to-transparent animate-pulse-soft"></div>
      <div className="hidden lg:block absolute bottom-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-dex-purple/20 to-transparent animate-pulse-soft" style={{ animationDelay: '-1.5s' }}></div>
      
      {/* Animated particles */}
      <div className="absolute inset-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <div 
            key={i}
            className="absolute w-1 h-1 rounded-full bg-dex-purple/30 animate-pulse-soft"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * -10}s`,
              animationDuration: `${3 + Math.random() * 7}s`
            }}
          ></div>
        ))}
      </div>
    </div>
  );
};

export default Background;
