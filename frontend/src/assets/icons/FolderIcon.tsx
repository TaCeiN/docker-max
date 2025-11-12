import React from 'react'

interface FolderIconProps {
  width?: number | string
  height?: number | string
  color?: string
}

export const FolderIcon: React.FC<FolderIconProps> = ({ 
  width = 20, 
  height = 20,
  color = 'currentColor'
}) => {
  const uniqueId = React.useId()
  const patternId = `pattern-folder-${uniqueId}`
  const imageId = `image-folder-${uniqueId}`
  
  return (
    <svg width={width} height={height} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink">
      <rect width="20" height="20" fill={`url(#${patternId})`}/>
      <defs>
        <pattern id={patternId} patternContentUnits="objectBoundingBox" width="1" height="1">
          <use xlinkHref={`#${imageId}`} transform="scale(0.0111111)"/>
        </pattern>
        <image id={imageId} width="90" height="90" preserveAspectRatio="none" xlinkHref="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAABaCAYAAAA4qEECAAAACXBIWXMAAAsTAAALEwEAmpwYAAAB3ElEQVR4nO2cPW5UMRRGXwXZQ6goqaP4hoY2BTshwB5SQUkL/kS6SCmziIRUwBaQgHbsIaJCFzlIaDqYJ837ue8c6ZQj2UeWn5u5XQcAAAAAADBX/P2TvZLTy6p0U7P9qDLvY5H9Ktm+FNl5yY+Pxt7XpLh9e/igyD73jfuP6Kdj7286J3kHkeuGax0+65bOn+tid5FrO9k5/Vzp4GG3ZO7u5B2Hrnemy27JVKX1MKHNi46edktlqMh1rrYXWLYPRemFvzm+T2jt3pLtU3uhEVrDxO51ssdeeJ2hq2zPCa1BvCa0hjCtCa1hJLQI7YsODQAAADAMfvHoXsnpdZF9G/vJVCduUfpaZK9as61Dtx+OvYE6M1uzPqE5ydoydLbvW4cee9F1phJahPZIElqE9kgSWoT2SBJahPZIElqE9kgSWoT2SBJahPZIElqE9kgSWoT2SBJahPZIElqE9kgSWoT2SBJahPZIElqE9kgSWoT2SBJahPZIElqE9kgSWpMNPdw4thrFbGXCAwZt2aN+2jy3CSzc5+TqnZ1sHbqNFmsjxsZefJ2JJaePvf45+3esMbH9fyLfntl+r8ibJ7vNc2v3Dx9I27C1SVftuuh9kgEAAAAAAAAAAAC6xfAbb0wbHFQ33TkAAAAASUVORK5CYII="/>
      </defs>
    </svg>
  )
}

