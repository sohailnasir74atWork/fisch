
// Default names for new accounts. These were Adopt Me pet names (NeonFox,
// MegaOwl, AdoptPro…) left over from the fork.
const FISCH_NAMES = [
  // Fishing
  'Angler',
  'Reeler',
  'BaitBoss',
  'HookLine',
  'DeepCast',
  'TideRider',
  'Lantern',
  'Bobber',
  'Glider',
  'Megalodon',
  'Shark',
  'Marlin',
  'Barracuda',
  'Swordfish',
  'Anglerfish',
  'Koi',
  'Pike',
  'Trout',
  'Squid',
  'Sailor',
  'Captain',
  'Harbor',
  'Abyss',
  'Moonlight',
  'Mythic',

  // Trading vibes
  'WFL',
  'BigWin',
  'Overpay',
  'FairDeal',
  'TradeKing',
  'TradeQueen',
  'ValuePro',
  'SwapMaster',
  'ScripRich',
  'SkinHunter',
];

  

  export const generateOnePieceUsername = () => {
    const randomName = FISCH_NAMES[Math.floor(Math.random() * FISCH_NAMES.length)];
    const randomNumber = Math.floor(100 + Math.random() * 900); // Random 4-digit number
    return `${randomName}_${randomNumber}`;
  };
  

  
  
  