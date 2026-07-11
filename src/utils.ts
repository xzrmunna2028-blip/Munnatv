export const getCountryFlag = (name: string): string => {
  if (!name) return "";
  const clean = name.trim().toLowerCase();
  
  const mapping: Record<string, string> = {
    'bangladesh': '🇧🇩', 'বাংলাদেশ': '🇧🇩', 'bd': '🇧🇩', 'ban': '🇧🇩',
    'india': '🇮🇳', 'ভারত': '🇮🇳', 'ind': '🇮🇳',
    'pakistan': '🇵🇰', 'পাকিস্তান': '🇵🇰', 'pak': '🇵🇰',
    'sri lanka': '🇱🇰', 'শ্রীলঙ্কা': '🇱🇰', 'sl': '🇱🇰', 'srilanka': '🇱🇰',
    'afghanistan': '🇦🇫', 'আফগানিস্তান': '🇦🇫', 'afg': '🇦🇫',
    'nepal': '🇳🇵', 'নেপাল': '🇳🇵', 'nep': '🇳🇵',
    'maldives': '🇲🇻', 'মালদ্বীপ': '🇲🇻', 'mdv': '🇲🇻',
    'bhutan': '🇧🇹', 'ভুটান': '🇧🇹', 'bhu': '🇧🇹',
    'uae': '🇦🇪', 'ইউএই': '🇦🇪', 'united arab emirates': '🇦🇪',
    'oman': '🇴🇲', 'ওমান': '🇴🇲',
    'saudi arabia': '🇸🇦', 'সৌদি আরব': '🇸🇦', 'saudi': '🇸🇦', 'ksa': '🇸🇦',
    'qatar': '🇶🇦', 'কাতার': '🇶🇦',
    'japan': '🇯🇵', 'জাপান': '🇯🇵', 'jpn': '🇯🇵',
    'south korea': '🇰🇷', 'দক্ষিণ কোরিয়া': '🇰🇷', 'korea': '🇰🇷', 'kor': '🇰🇷',
    'china': '🇨🇳', 'চীন': '🇨🇳', 'chn': '🇨🇳',
    'australia': '🇦🇺', 'অস্ট্রেলিয়া': '🇦🇺', 'aus': '🇦🇺',
    'new zealand': '🇳🇿', 'নিউজিল্যান্ড': '🇳🇿', 'nz': '🇳🇿',
    'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'ইংল্যান্ড': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'eng': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'uk': '🇬🇧',
    'south africa': '🇿🇦', 'দক্ষিণ আফ্রিকা': '🇿🇦', 'rsa': '🇿🇦', 'sa': '🇿🇦',
    'west indies': '🌴', 'ওয়েস্ট ইন্ডিজ': '🌴', 'wi': '🌴',
    'usa': '🇺🇸', 'ইউএসএ': '🇺🇸', 'america': '🇺🇸', 'united states': '🇺🇸',
    'argentina': '🇦🇷', 'আর্জেন্টিনা': '🇦🇷', 'arg': '🇦🇷',
    'brazil': '🇧🇷', 'ব্রাজিল': '🇧🇷', 'bra': '🇧🇷',
    'germany': '🇩🇪', 'জার্মানি': '🇩🇪', 'ger': '🇩🇪',
    'france': '🇫🇷', 'ফ্রান্স': '🇫🇷', 'fra': '🇫🇷',
    'spain': '🇪🇸', 'স্পেন': '🇪🇸', 'esp': '🇪🇸',
    'portugal': '🇵🇹', 'পর্তুগাল': '🇵🇹', 'por': '🇵🇹',
    'italy': '🇮🇹', 'ইতালি': '🇮🇹', 'ita': '🇮🇹',
  };

  if (mapping[clean]) return mapping[clean];
  for (const [key, flag] of Object.entries(mapping)) {
    if (clean.includes(key) || key.includes(clean)) {
      return flag;
    }
  }
  return "🏳️";
};
