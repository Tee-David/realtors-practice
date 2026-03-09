'use client';
import { motion, AnimatePresence } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

interface ModernLoaderProps {
  words: string[];
}

const ModernLoader: React.FC<ModernLoaderProps> = ({ words }) => {
  const [index, setIndex] = useState(0);
  const { theme, systemTheme } = useTheme();
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const isDark = currentTheme !== 'light'; // Default to dark if undefined

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % words.length);
    }, 3000); // Change word every 3 seconds

    return () => clearInterval(interval);
  }, [words.length]);

  return (
    <div className={`flex flex-col items-center justify-center p-8 rounded-2xl ${isDark ? 'bg-[#1a1b26]' : 'bg-white'} shadow-xl max-w-md mx-auto`}>
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 180, 360],
          borderRadius: ['20%', '50%', '20%'],
        }}
        transition={{
          duration: 2,
          ease: 'easeInOut',
          times: [0, 0.5, 1],
          repeat: Infinity,
        }}
        className={`w-16 h-16 ${isDark ? 'bg-indigo-500' : 'bg-indigo-600'} flex items-center justify-center mb-8`}
      >
        <motion.div
          animate={{
            scale: [1, 0.5, 1],
            rotate: [0, -180, -360],
          }}
          transition={{
            duration: 2,
            ease: 'easeInOut',
            times: [0, 0.5, 1],
            repeat: Infinity,
          }}
          className={`w-8 h-8 ${isDark ? 'bg-white' : 'bg-indigo-100'} rounded-sm`}
        />
      </motion.div>

      <div className="h-12 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`text-lg font-medium text-center ${isDark ? 'text-indigo-200' : 'text-indigo-800'}`}
          >
            {words[index]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex space-x-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              y: ['0%', '-50%', '0%'],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.2,
            }}
            className={`w-3 h-3 rounded-full ${isDark ? 'bg-indigo-400' : 'bg-indigo-500'}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ModernLoader;
