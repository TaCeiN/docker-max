import React from 'react'

interface DocumentIconProps {
  width?: number | string
  height?: number | string
  color?: string
}

export const DocumentIcon: React.FC<DocumentIconProps> = ({ 
  width = 20, 
  height = 20,
  color = 'currentColor'
}) => {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="4" width="12" height="16" rx="1.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="9" y1="9" x2="15" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9" y1="12" x2="13" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="9" y1="15" x2="11" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}





