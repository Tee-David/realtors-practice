import React from 'react';
import './glass-card.css';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
}

const GlassCard = ({ children, className = '' }: GlassCardProps) => {
  return <div className={`glass-card ${className}`}>{children}</div>;
};

export default GlassCard;
