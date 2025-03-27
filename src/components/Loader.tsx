import { useState, useEffect } from 'react';

type LoaderProps = {
  type?: 'default' | 'redirect' | 'content';
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'success' | 'danger';
};

const Loader = ({
  type = 'default',
  text = '',
  size = 'md',
  color = 'primary'
}: LoaderProps) => {
  const [progress, setProgress] = useState(0);

  // Simulated progress for redirect loaders
  useEffect(() => {
    if (type === 'redirect') {
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + 2;
          if (newProgress >= 100) {
            clearInterval(interval);
            return 100;
          }
          return newProgress;
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [type]);

  // Size mappings
  const sizeMap = {
    sm: { container: 'h-16 w-16', ring: 'h-14 w-14', inner: 'h-10 w-10', text: 'text-xs' },
    md: { container: 'h-24 w-24', ring: 'h-20 w-20', inner: 'h-16 w-16', text: 'text-sm' },
    lg: { container: 'h-32 w-32', ring: 'h-28 w-28', inner: 'h-24 w-24', text: 'text-base' }
  };

  // Color mappings
  const colorMap = {
    primary: { ring: 'border-blue-500', pulse: 'bg-blue-500', text: 'text-blue-500' },
    secondary: { ring: 'border-purple-500', pulse: 'bg-purple-500', text: 'text-purple-500' },
    success: { ring: 'border-green-500', pulse: 'bg-green-500', text: 'text-green-500' },
    danger: { ring: 'border-red-500', pulse: 'bg-red-500', text: 'text-red-500' }
  };

  const selectedSize = sizeMap[size] || sizeMap.md;
  const selectedColor = colorMap[color] || colorMap.primary;

  // Default spinner loader
  if (type === 'default') {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <div className={`relative ${selectedSize.container} flex items-center justify-center`}>
          {/* Outer rotating ring */}
          <div className={`absolute ${selectedSize.ring} border-4 ${selectedColor.ring} rounded-full animate-spin border-t-transparent`}></div>

          {/* Inner pulsing circle */}
          <div className={`${selectedSize.inner} ${selectedColor.pulse} rounded-full opacity-30 animate-pulse`}></div>
        </div>

        {text && (
          <p className={`mt-4 font-medium ${selectedColor.text} ${selectedSize.text}`}>{text}</p>
        )}
      </div>
    );
  }

  // Redirect loader with progress indicator
  if (type === 'redirect') {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <div className="relative w-64">
          {/* Progress text */}
          <div className="text-center mb-2">
            <span className={`font-medium ${selectedColor.text}`}>{text || 'Redirecting...'}</span>
          </div>

          {/* Progress bar container */}
          <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
            {/* Progress bar fill */}
            <div
              className={`h-full ${selectedColor.pulse} rounded-full transition-all duration-300 ease-out`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Progress percentage */}
          <div className="text-right mt-1">
            <span className={`text-xs ${selectedColor.text}`}>{progress}%</span>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard content loader with skeleton
  if (type === 'content') {
    return (
      <div className="flex flex-col w-full animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between w-full mb-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-8 bg-gray-200 rounded w-24"></div>
        </div>

        {/* Content skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-lg p-4">
              <div className="h-4 bg-gray-200 rounded mb-3 w-3/4"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded mt-3 w-1/2"></div>
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="h-4 bg-gray-200 rounded mb-3 w-1/4"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4">
                <div className="h-4 bg-gray-200 rounded col-span-1"></div>
                <div className="h-4 bg-gray-200 rounded col-span-2"></div>
                <div className="h-4 bg-gray-200 rounded col-span-1"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Loader;
