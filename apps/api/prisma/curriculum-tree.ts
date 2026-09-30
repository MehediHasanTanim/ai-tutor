/**
 * Class 9–10 Science curriculum tree — doc 07 Weeks 3–4 seed.
 *
 * Chapter titles follow the NCTB Class 9–10 syllabus, which is a single
 * combined syllabus for both years in most Science subjects — so chapters are
 * declared once per subject code and seeded against both class levels.
 *
 * Topics are a working decomposition, not an NCTB artefact: the syllabus
 * names chapters, and topic-level granularity is ours to choose because it is
 * what `topic_mastery` tracks and what weak-topic detection reports back to a
 * student. They are deliberately coarse — a topic a student can be told they
 * are weak at has to be something they recognise.
 *
 * **Needs subject-matter review.** Chapter ordering and Bangla titles should
 * be checked against a current NCTB textbook before this is treated as
 * authoritative; doc 07 §13 item 5 asks for a Class 9–10 teacher on the team
 * for exactly this kind of content.
 */

export interface TopicSeed {
  title: string;
  titleBn: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
}

export interface ChapterSeed {
  number: number;
  title: string;
  titleBn: string;
  topics: TopicSeed[];
}

export type CurriculumTree = Record<string, ChapterSeed[]>;

const physics: ChapterSeed[] = [
  {
    number: 1,
    title: 'Physical Quantities and Measurement',
    titleBn: 'ভৌত রাশি এবং পরিমাপ',
    topics: [
      {
        title: 'Fundamental and derived quantities',
        titleBn: 'মৌলিক ও লব্ধ রাশি',
        difficulty: 'EASY',
      },
      { title: 'SI units', titleBn: 'এস আই একক', difficulty: 'EASY' },
      { title: 'Measurement instruments and error', titleBn: 'পরিমাপ যন্ত্র ও ত্রুটি' },
    ],
  },
  {
    number: 2,
    title: 'Motion',
    titleBn: 'গতি',
    topics: [
      {
        title: 'Scalar and vector quantities',
        titleBn: 'স্কেলার ও ভেক্টর রাশি',
        difficulty: 'EASY',
      },
      { title: 'Speed, velocity and acceleration', titleBn: 'দ্রুতি, বেগ ও ত্বরণ' },
      { title: 'Equations of motion', titleBn: 'গতির সমীকরণ', difficulty: 'HARD' },
      { title: 'Motion graphs', titleBn: 'গতির লেখচিত্র' },
    ],
  },
  {
    number: 3,
    title: 'Force',
    titleBn: 'বল',
    topics: [
      { title: "Newton's laws of motion", titleBn: 'নিউটনের গতিসূত্র' },
      { title: 'Momentum and impulse', titleBn: 'ভরবেগ ও ঘাত', difficulty: 'HARD' },
      { title: 'Friction', titleBn: 'ঘর্ষণ', difficulty: 'EASY' },
      { title: 'Gravitation', titleBn: 'মহাকর্ষ' },
    ],
  },
  {
    number: 4,
    title: 'Work, Power and Energy',
    titleBn: 'কাজ, ক্ষমতা ও শক্তি',
    topics: [
      { title: 'Work and its measurement', titleBn: 'কাজ ও এর পরিমাপ', difficulty: 'EASY' },
      { title: 'Kinetic and potential energy', titleBn: 'গতিশক্তি ও বিভবশক্তি' },
      { title: 'Conservation of energy', titleBn: 'শক্তির নিত্যতা' },
      { title: 'Power and efficiency', titleBn: 'ক্ষমতা ও দক্ষতা' },
    ],
  },
  {
    number: 5,
    title: 'States of Matter and Pressure',
    titleBn: 'পদার্থের অবস্থা ও চাপ',
    topics: [
      {
        title: 'Density and relative density',
        titleBn: 'ঘনত্ব ও আপেক্ষিক ঘনত্ব',
        difficulty: 'EASY',
      },
      { title: 'Pressure in liquids', titleBn: 'তরলের চাপ' },
      { title: "Archimedes' principle and flotation", titleBn: 'আর্কিমিডিসের সূত্র ও ভাসন' },
    ],
  },
  {
    number: 6,
    title: 'Heat and Temperature',
    titleBn: 'তাপ ও তাপমাত্রা',
    topics: [
      { title: 'Temperature scales', titleBn: 'তাপমাত্রার স্কেল', difficulty: 'EASY' },
      { title: 'Specific heat capacity', titleBn: 'আপেক্ষিক তাপ' },
      { title: 'Latent heat and change of state', titleBn: 'সুপ্ততাপ ও অবস্থার পরিবর্তন' },
      { title: 'Expansion of solids and liquids', titleBn: 'কঠিন ও তরলের প্রসারণ' },
    ],
  },
  {
    number: 7,
    title: 'Waves and Sound',
    titleBn: 'তরঙ্গ ও শব্দ',
    topics: [
      { title: 'Wave characteristics', titleBn: 'তরঙ্গের বৈশিষ্ট্য', difficulty: 'EASY' },
      { title: 'Speed of sound', titleBn: 'শব্দের বেগ' },
      { title: 'Reflection of sound and echo', titleBn: 'শব্দের প্রতিফলন ও প্রতিধ্বনি' },
    ],
  },
  {
    number: 8,
    title: 'Reflection of Light',
    titleBn: 'আলোর প্রতিফলন',
    topics: [
      { title: 'Laws of reflection', titleBn: 'প্রতিফলনের সূত্র', difficulty: 'EASY' },
      { title: 'Plane and spherical mirrors', titleBn: 'সমতল ও গোলীয় দর্পণ' },
      {
        title: 'Image formation and mirror formula',
        titleBn: 'প্রতিবিম্ব গঠন ও দর্পণ সূত্র',
        difficulty: 'HARD',
      },
    ],
  },
  {
    number: 9,
    title: 'Refraction of Light',
    titleBn: 'আলোর প্রতিসরণ',
    topics: [
      { title: 'Refractive index', titleBn: 'প্রতিসরণাঙ্ক' },
      { title: "Snell's law", titleBn: 'স্নেলের সূত্র' },
      {
        title: 'Total internal reflection',
        titleBn: 'পূর্ণ অভ্যন্তরীণ প্রতিফলন',
        difficulty: 'HARD',
      },
      { title: 'Lenses and the human eye', titleBn: 'লেন্স ও মানুষের চোখ' },
    ],
  },
  {
    number: 10,
    title: 'Current Electricity',
    titleBn: 'চল বিদ্যুৎ',
    topics: [
      { title: "Ohm's law and resistance", titleBn: 'ওহমের সূত্র ও রোধ' },
      {
        title: 'Series and parallel circuits',
        titleBn: 'শ্রেণি ও সমান্তরাল বর্তনী',
        difficulty: 'HARD',
      },
      { title: 'Electrical power and energy', titleBn: 'বৈদ্যুতিক ক্ষমতা ও শক্তি' },
    ],
  },
  {
    number: 11,
    title: 'Magnetic Effects of Current',
    titleBn: 'তড়িতের চৌম্বক ক্রিয়া',
    topics: [
      { title: 'Magnetic field of a current', titleBn: 'তড়িৎপ্রবাহের চৌম্বক ক্ষেত্র' },
      { title: 'Electromagnetic induction', titleBn: 'তড়িৎ চুম্বকীয় আবেশ', difficulty: 'HARD' },
      { title: 'Motors and generators', titleBn: 'মোটর ও জেনারেটর' },
    ],
  },
  {
    number: 12,
    title: 'Modern Physics and Electronics',
    titleBn: 'আধুনিক পদার্থবিজ্ঞান ও ইলেকট্রনিক্স',
    topics: [
      { title: 'Radioactivity', titleBn: 'তেজস্ক্রিয়তা' },
      { title: 'Semiconductors and diodes', titleBn: 'অর্ধপরিবাহী ও ডায়োড' },
    ],
  },
];

const chemistry: ChapterSeed[] = [
  {
    number: 1,
    title: 'Concept of Chemistry',
    titleBn: 'রসায়নের ধারণা',
    topics: [
      {
        title: 'Scope and importance of chemistry',
        titleBn: 'রসায়নের পরিধি ও গুরুত্ব',
        difficulty: 'EASY',
      },
      { title: 'Laboratory safety', titleBn: 'গবেষণাগারের নিরাপত্তা', difficulty: 'EASY' },
    ],
  },
  {
    number: 2,
    title: 'States of Matter',
    titleBn: 'পদার্থের অবস্থা',
    topics: [
      { title: 'Solid, liquid and gas', titleBn: 'কঠিন, তরল ও গ্যাস', difficulty: 'EASY' },
      { title: 'Diffusion and change of state', titleBn: 'ব্যাপন ও অবস্থার পরিবর্তন' },
    ],
  },
  {
    number: 3,
    title: 'Structure of Matter',
    titleBn: 'পদার্থের গঠন',
    topics: [
      { title: 'Atomic models', titleBn: 'পরমাণু মডেল' },
      { title: 'Electron configuration', titleBn: 'ইলেকট্রন বিন্যাস', difficulty: 'HARD' },
      { title: 'Isotopes', titleBn: 'আইসোটোপ' },
    ],
  },
  {
    number: 4,
    title: 'Periodic Table',
    titleBn: 'পর্যায় সারণি',
    topics: [
      { title: 'Periods and groups', titleBn: 'পর্যায় ও গ্রুপ' },
      { title: 'Periodic properties', titleBn: 'পর্যায়বৃত্ত ধর্ম', difficulty: 'HARD' },
    ],
  },
  {
    number: 5,
    title: 'Chemical Bonds',
    titleBn: 'রাসায়নিক বন্ধন',
    topics: [
      { title: 'Ionic bonding', titleBn: 'আয়নিক বন্ধন' },
      { title: 'Covalent bonding', titleBn: 'সমযোজী বন্ধন' },
      { title: 'Properties of ionic and covalent compounds', titleBn: 'যৌগের ধর্ম' },
    ],
  },
  {
    number: 6,
    title: 'Chemical Reactions',
    titleBn: 'রাসায়নিক বিক্রিয়া',
    topics: [
      { title: 'Balancing equations', titleBn: 'সমীকরণ সমতাকরণ', difficulty: 'HARD' },
      { title: 'Types of reaction', titleBn: 'বিক্রিয়ার প্রকারভেদ' },
      { title: 'Rate of reaction', titleBn: 'বিক্রিয়ার হার' },
    ],
  },
  {
    number: 7,
    title: 'Quantitative Chemistry',
    titleBn: 'পরিমাণগত রসায়ন',
    topics: [
      { title: 'Mole concept', titleBn: 'মোল ধারণা', difficulty: 'HARD' },
      { title: 'Molar mass and calculations', titleBn: 'মোলার ভর ও গণনা', difficulty: 'HARD' },
    ],
  },
  {
    number: 8,
    title: 'Acids, Bases and Salts',
    titleBn: 'অম্ল, ক্ষার ও লবণ',
    topics: [
      {
        title: 'Properties of acids and bases',
        titleBn: 'অম্ল ও ক্ষারের ধর্ম',
        difficulty: 'EASY',
      },
      { title: 'pH scale', titleBn: 'পিএইচ স্কেল' },
      { title: 'Neutralisation and salts', titleBn: 'প্রশমন ও লবণ' },
    ],
  },
  {
    number: 9,
    title: 'Chemistry and Energy',
    titleBn: 'রসায়ন ও শক্তি',
    topics: [
      { title: 'Exothermic and endothermic reactions', titleBn: 'তাপোৎপাদী ও তাপহারী বিক্রিয়া' },
      { title: 'Electrolysis', titleBn: 'তড়িৎ বিশ্লেষণ', difficulty: 'HARD' },
    ],
  },
  {
    number: 10,
    title: 'Organic Chemistry',
    titleBn: 'জৈব রসায়ন',
    topics: [
      { title: 'Hydrocarbons', titleBn: 'হাইড্রোকার্বন' },
      { title: 'Alcohols and organic acids', titleBn: 'অ্যালকোহল ও জৈব অম্ল' },
    ],
  },
];

const biology: ChapterSeed[] = [
  {
    number: 1,
    title: 'Life and Classification',
    titleBn: 'জীবন পাঠ ও শ্রেণিবিন্যাস',
    topics: [
      { title: 'Characteristics of living things', titleBn: 'জীবের বৈশিষ্ট্য', difficulty: 'EASY' },
      { title: 'Taxonomy and nomenclature', titleBn: 'শ্রেণিবিন্যাস ও নামকরণ' },
    ],
  },
  {
    number: 2,
    title: 'Cell and Tissue',
    titleBn: 'জীবকোষ ও টিস্যু',
    topics: [
      { title: 'Cell structure and organelles', titleBn: 'কোষের গঠন ও অঙ্গাণু' },
      { title: 'Plant and animal tissue', titleBn: 'উদ্ভিদ ও প্রাণী টিস্যু' },
      { title: 'Cell division', titleBn: 'কোষ বিভাজন', difficulty: 'HARD' },
    ],
  },
  {
    number: 3,
    title: 'Cellular Energy',
    titleBn: 'কোষীয় শক্তি',
    topics: [
      { title: 'Photosynthesis', titleBn: 'সালোকসংশ্লেষণ' },
      { title: 'Respiration', titleBn: 'শ্বসন' },
    ],
  },
  {
    number: 4,
    title: 'Nutrition and Digestion',
    titleBn: 'খাদ্য ও পুষ্টি',
    topics: [
      { title: 'Food components', titleBn: 'খাদ্য উপাদান', difficulty: 'EASY' },
      { title: 'Human digestive system', titleBn: 'মানব পরিপাকতন্ত্র' },
      {
        title: 'Balanced diet and malnutrition',
        titleBn: 'সুষম খাদ্য ও অপুষ্টি',
        difficulty: 'EASY',
      },
    ],
  },
  {
    number: 5,
    title: 'Transport in Organisms',
    titleBn: 'জীবে পরিবহন',
    topics: [
      { title: 'Transport in plants', titleBn: 'উদ্ভিদে পরিবহন' },
      { title: 'Blood and circulation', titleBn: 'রক্ত ও সংবহন' },
      { title: 'Heart and blood vessels', titleBn: 'হৃৎপিণ্ড ও রক্তনালি' },
    ],
  },
  {
    number: 6,
    title: 'Excretion and Respiration',
    titleBn: 'রেচন ও শ্বসনতন্ত্র',
    topics: [
      { title: 'Human respiratory system', titleBn: 'মানব শ্বসনতন্ত্র' },
      { title: 'Kidneys and excretion', titleBn: 'বৃক্ক ও রেচন' },
    ],
  },
  {
    number: 7,
    title: 'Coordination and Movement',
    titleBn: 'সমন্বয় ও চলন',
    topics: [
      { title: 'Nervous system', titleBn: 'স্নায়ুতন্ত্র', difficulty: 'HARD' },
      { title: 'Hormones', titleBn: 'হরমোন' },
      { title: 'Skeletal system', titleBn: 'অস্থিতন্ত্র', difficulty: 'EASY' },
    ],
  },
  {
    number: 8,
    title: 'Reproduction',
    titleBn: 'জীবের প্রজনন',
    topics: [
      { title: 'Reproduction in plants', titleBn: 'উদ্ভিদের প্রজনন' },
      { title: 'Human reproductive system', titleBn: 'মানব প্রজননতন্ত্র' },
    ],
  },
  {
    number: 9,
    title: 'Heredity and Evolution',
    titleBn: 'বংশগতি ও বিবর্তন',
    topics: [
      { title: 'Genes and chromosomes', titleBn: 'জিন ও ক্রোমোজোম' },
      { title: "Mendel's laws", titleBn: 'মেন্ডেলের সূত্র', difficulty: 'HARD' },
      { title: 'Evolution', titleBn: 'বিবর্তন' },
    ],
  },
  {
    number: 10,
    title: 'Environment and Ecosystem',
    titleBn: 'পরিবেশ ও বাস্তুতন্ত্র',
    topics: [
      { title: 'Food chains and webs', titleBn: 'খাদ্য শৃঙ্খল ও খাদ্য জাল', difficulty: 'EASY' },
      { title: 'Biodiversity and conservation', titleBn: 'জীববৈচিত্র্য ও সংরক্ষণ' },
    ],
  },
];

const math: ChapterSeed[] = [
  {
    number: 1,
    title: 'Real Numbers',
    titleBn: 'বাস্তব সংখ্যা',
    topics: [
      {
        title: 'Rational and irrational numbers',
        titleBn: 'মূলদ ও অমূলদ সংখ্যা',
        difficulty: 'EASY',
      },
      { title: 'Number line and intervals', titleBn: 'সংখ্যারেখা ও ব্যবধি' },
    ],
  },
  {
    number: 2,
    title: 'Sets and Functions',
    titleBn: 'সেট ও ফাংশন',
    topics: [
      { title: 'Set operations', titleBn: 'সেটের অপারেশন', difficulty: 'EASY' },
      { title: 'Venn diagrams', titleBn: 'ভেনচিত্র' },
      { title: 'Functions and graphs', titleBn: 'ফাংশন ও লেখচিত্র', difficulty: 'HARD' },
    ],
  },
  {
    number: 3,
    title: 'Algebraic Expressions',
    titleBn: 'বীজগাণিতিক রাশি',
    topics: [
      { title: 'Formulae and identities', titleBn: 'সূত্র ও অভেদ' },
      { title: 'Factorisation', titleBn: 'উৎপাদকে বিশ্লেষণ' },
      { title: 'Partial fractions', titleBn: 'আংশিক ভগ্নাংশ', difficulty: 'HARD' },
    ],
  },
  {
    number: 4,
    title: 'Exponents and Logarithms',
    titleBn: 'সূচক ও লগারিদম',
    topics: [
      { title: 'Laws of exponents', titleBn: 'সূচকের সূত্র' },
      { title: 'Logarithms', titleBn: 'লগারিদম', difficulty: 'HARD' },
    ],
  },
  {
    number: 5,
    title: 'Equations',
    titleBn: 'সমীকরণ',
    topics: [
      { title: 'Linear equations', titleBn: 'এক চলকবিশিষ্ট সমীকরণ', difficulty: 'EASY' },
      { title: 'Simultaneous equations', titleBn: 'সহসমীকরণ' },
      { title: 'Quadratic equations', titleBn: 'দ্বিঘাত সমীকরণ', difficulty: 'HARD' },
    ],
  },
  {
    number: 6,
    title: 'Lines, Angles and Triangles',
    titleBn: 'রেখা, কোণ ও ত্রিভুজ',
    topics: [
      { title: 'Angle properties', titleBn: 'কোণের ধর্ম', difficulty: 'EASY' },
      { title: 'Congruence and similarity', titleBn: 'সর্বসমতা ও সদৃশতা' },
      { title: 'Pythagoras theorem', titleBn: 'পিথাগোরাসের উপপাদ্য' },
    ],
  },
  {
    number: 7,
    title: 'Circles',
    titleBn: 'বৃত্ত',
    topics: [
      { title: 'Chords and arcs', titleBn: 'জ্যা ও চাপ' },
      { title: 'Tangents', titleBn: 'স্পর্শক', difficulty: 'HARD' },
    ],
  },
  {
    number: 8,
    title: 'Trigonometry',
    titleBn: 'ত্রিকোণমিতি',
    topics: [
      { title: 'Trigonometric ratios', titleBn: 'ত্রিকোণমিতিক অনুপাত' },
      { title: 'Trigonometric identities', titleBn: 'ত্রিকোণমিতিক অভেদ', difficulty: 'HARD' },
      { title: 'Heights and distances', titleBn: 'উচ্চতা ও দূরত্ব' },
    ],
  },
  {
    number: 9,
    title: 'Mensuration',
    titleBn: 'পরিমিতি',
    topics: [
      { title: 'Area of plane figures', titleBn: 'সমতলীয় ক্ষেত্রফল', difficulty: 'EASY' },
      { title: 'Surface area and volume', titleBn: 'পৃষ্ঠতল ও আয়তন' },
    ],
  },
  {
    number: 10,
    title: 'Statistics and Probability',
    titleBn: 'পরিসংখ্যান ও সম্ভাবনা',
    topics: [
      { title: 'Mean, median and mode', titleBn: 'গড়, মধ্যক ও প্রচুরক', difficulty: 'EASY' },
      { title: 'Frequency distribution', titleBn: 'গণসংখ্যা নিবেশন' },
      { title: 'Basic probability', titleBn: 'প্রাথমিক সম্ভাবনা' },
    ],
  },
];

const ict: ChapterSeed[] = [
  {
    number: 1,
    title: 'ICT in Daily Life',
    titleBn: 'তথ্য ও যোগাযোগ প্রযুক্তি ও আমাদের জীবন',
    topics: [
      { title: 'Uses of ICT', titleBn: 'আইসিটির ব্যবহার', difficulty: 'EASY' },
      { title: 'Ethics and safety', titleBn: 'নৈতিকতা ও নিরাপত্তা', difficulty: 'EASY' },
    ],
  },
  {
    number: 2,
    title: 'Computer and Components',
    titleBn: 'কম্পিউটার ও এর যন্ত্রাংশ',
    topics: [
      { title: 'Hardware and software', titleBn: 'হার্ডওয়্যার ও সফটওয়্যার', difficulty: 'EASY' },
      { title: 'Input, output and storage', titleBn: 'ইনপুট, আউটপুট ও সংরক্ষণ' },
      { title: 'Operating systems', titleBn: 'অপারেটিং সিস্টেম' },
    ],
  },
  {
    number: 3,
    title: 'Number Systems and Logic',
    titleBn: 'সংখ্যা পদ্ধতি ও ডিজিটাল ডিভাইস',
    topics: [
      { title: 'Binary, octal and hexadecimal', titleBn: 'বাইনারি, অকটাল ও হেক্সাডেসিমেল' },
      { title: 'Number conversion', titleBn: 'সংখ্যা রূপান্তর', difficulty: 'HARD' },
      { title: 'Logic gates', titleBn: 'লজিক গেট', difficulty: 'HARD' },
    ],
  },
  {
    number: 4,
    title: 'Networks and the Internet',
    titleBn: 'নেটওয়ার্ক ও ইন্টারনেট',
    topics: [
      { title: 'LAN, MAN and WAN', titleBn: 'ল্যান, ম্যান ও ওয়্যান' },
      { title: 'Network topology', titleBn: 'নেটওয়ার্ক টপোলজি' },
      { title: 'Internet services', titleBn: 'ইন্টারনেট সেবা', difficulty: 'EASY' },
    ],
  },
  {
    number: 5,
    title: 'Word Processing and Spreadsheets',
    titleBn: 'ওয়ার্ড প্রসেসিং ও স্প্রেডশিট',
    topics: [
      { title: 'Document formatting', titleBn: 'ডকুমেন্ট ফরম্যাটিং', difficulty: 'EASY' },
      { title: 'Spreadsheet formulas', titleBn: 'স্প্রেডশিট সূত্র' },
    ],
  },
  {
    number: 6,
    title: 'Database Management',
    titleBn: 'ডেটাবেজ ব্যবস্থাপনা',
    topics: [
      { title: 'Tables, records and fields', titleBn: 'টেবিল, রেকর্ড ও ফিল্ড', difficulty: 'EASY' },
      { title: 'Primary and foreign keys', titleBn: 'প্রাইমারি ও ফরেন কী' },
      { title: 'Queries and sorting', titleBn: 'কুয়েরি ও সাজানো' },
    ],
  },
  {
    number: 7,
    title: 'Programming Concepts',
    titleBn: 'প্রোগ্রামিং ধারণা',
    topics: [
      { title: 'Algorithms and flowcharts', titleBn: 'অ্যালগরিদম ও ফ্লোচার্ট' },
      {
        title: 'Variables and control flow',
        titleBn: 'চলক ও নিয়ন্ত্রণ প্রবাহ',
        difficulty: 'HARD',
      },
    ],
  },
];

const english: ChapterSeed[] = [
  {
    number: 1,
    title: 'Parts of Speech',
    titleBn: 'পদ প্রকরণ',
    topics: [
      { title: 'Nouns and pronouns', titleBn: 'বিশেষ্য ও সর্বনাম', difficulty: 'EASY' },
      { title: 'Verbs and adverbs', titleBn: 'ক্রিয়া ও ক্রিয়াবিশেষণ' },
      { title: 'Prepositions', titleBn: 'পদান্বয়ী অব্যয়' },
    ],
  },
  {
    number: 2,
    title: 'Tense',
    titleBn: 'কাল',
    topics: [
      { title: 'Present, past and future', titleBn: 'বর্তমান, অতীত ও ভবিষ্যৎ', difficulty: 'EASY' },
      {
        title: 'Perfect and continuous forms',
        titleBn: 'পুরাঘটিত ও ঘটমান রূপ',
        difficulty: 'HARD',
      },
    ],
  },
  {
    number: 3,
    title: 'Sentence Structure',
    titleBn: 'বাক্য গঠন',
    topics: [
      {
        title: 'Simple, complex and compound',
        titleBn: 'সরল, জটিল ও যৌগিক বাক্য',
        difficulty: 'HARD',
      },
      { title: 'Transformation of sentences', titleBn: 'বাক্য রূপান্তর' },
    ],
  },
  {
    number: 4,
    title: 'Voice and Narration',
    titleBn: 'বাচ্য ও উক্তি',
    topics: [
      { title: 'Active and passive voice', titleBn: 'কর্তৃবাচ্য ও কর্মবাচ্য' },
      {
        title: 'Direct and indirect speech',
        titleBn: 'প্রত্যক্ষ ও পরোক্ষ উক্তি',
        difficulty: 'HARD',
      },
    ],
  },
  {
    number: 5,
    title: 'Vocabulary and Comprehension',
    titleBn: 'শব্দভাণ্ডার ও অনুধাবন',
    topics: [
      { title: 'Synonyms and antonyms', titleBn: 'সমার্থক ও বিপরীতার্থক শব্দ', difficulty: 'EASY' },
      { title: 'Reading comprehension', titleBn: 'পঠিত অংশ অনুধাবন' },
    ],
  },
  {
    number: 6,
    title: 'Writing',
    titleBn: 'রচনা',
    topics: [
      { title: 'Paragraph and composition', titleBn: 'অনুচ্ছেদ ও রচনা' },
      {
        title: 'Letters, emails and applications',
        titleBn: 'চিঠি, ইমেইল ও আবেদনপত্র',
        difficulty: 'EASY',
      },
    ],
  },
];

/** Keyed by subject code, matching the seed's subject list. */
export const CURRICULUM_TREE: CurriculumTree = {
  physics,
  chemistry,
  biology,
  math,
  ict,
  english,
};
