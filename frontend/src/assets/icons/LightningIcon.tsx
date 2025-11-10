import React from 'react'

interface LightningIconProps {
  isActive?: boolean
  width?: number
  height?: number
  className?: string
}

export const LightningIcon: React.FC<LightningIconProps> = ({ 
  isActive = false, 
  width = 20, 
  height = 20,
  className = '' 
}) => {
  const fillColor = isActive ? "#4a90e2" : "#ffffff"
  
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ 
        width: `${width}px`, 
        height: `${height}px`,
        transition: 'fill 0.2s ease'
      }}
    >
      <path 
        d="M13 2L3 14H12L11 22L21 10H12L13 2Z" 
        fill={fillColor}
        stroke={fillColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

