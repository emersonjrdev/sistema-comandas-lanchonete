import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768

export function useResponsive() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return { isMobile }
}

export function useIsMobile() {
  const { isMobile } = useResponsive()
  return isMobile
}
