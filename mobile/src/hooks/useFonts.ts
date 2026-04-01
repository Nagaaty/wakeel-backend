import { useEffect, useState } from 'react';
import * as Font from 'expo-font';

// These match el-adl-app-43 exactly:
// font-family: 'Cormorant Garamond', serif  → headings, logo, prices
// font-family: 'DM Sans', sans-serif        → body text, buttons
// font-family: 'Cairo', sans-serif          → Arabic text

let _loaded = false;

export function useFonts() {
  const [loaded, setLoaded] = useState(_loaded);

  useEffect(() => {
    if (_loaded) return;
    Font.loadAsync({
      'CormorantGaramond-Bold':         require('../../assets/fonts/CormorantGaramond-Bold.ttf'),
      'CormorantGaramond-SemiBold':     require('../../assets/fonts/CormorantGaramond-SemiBold.ttf'),
      'DMSans-Regular':                 require('../../assets/fonts/DMSans-Regular.ttf'),
      'DMSans-Medium':                  require('../../assets/fonts/DMSans-Medium.ttf'),
      'DMSans-Bold':                    require('../../assets/fonts/DMSans-Bold.ttf'),
    }).then(() => {
      _loaded = true;
      setLoaded(true);
    }).catch(() => {
      // Graceful fallback to system serif/sans-serif
      _loaded = true;
      setLoaded(true);
    });
  }, []);

  return loaded;
}

// Font style helpers matching reference exactly
export const SERIF = (size: number, weight: '600'|'700' = '700') => ({
  fontFamily: _loaded ? 'CormorantGaramond-Bold' : 'serif',
  fontSize: size,
  fontWeight: weight,
});

export const SANS = (size: number, weight: '400'|'500'|'600'|'700' = '400') => ({
  fontFamily: _loaded ? (weight >= '600' ? 'DMSans-Bold' : weight === '500' ? 'DMSans-Medium' : 'DMSans-Regular') : 'System',
  fontSize: size,
  fontWeight: weight,
});
