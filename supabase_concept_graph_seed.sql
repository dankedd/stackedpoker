-- ============================================================
-- Poker Concept Graph Seed
-- Tables: concept_nodes, concept_edges, learning_paths
-- Run in Supabase SQL editor or via supabase db push
-- Idempotent: uses ON CONFLICT DO UPDATE throughout
-- ============================================================

-- ============================================================
-- CONCEPT NODES
-- ============================================================

INSERT INTO public.concept_nodes (id, title, domain, difficulty, summary) VALUES

-- Game Theory
('mdf',
 'Minimum Defense Frequency',
 'game_theory',
 'intermediate',
 'The minimum fraction of your range you must continue with when facing a bet to prevent your opponent from profitably bluffing with any two cards; formula: MDF = pot / (pot + bet) = 1 − alpha.'),

('alpha',
 'Alpha — Required Fold Frequency',
 'game_theory',
 'intermediate',
 'The fold frequency a bluff needs to break even against a defender; formula: alpha = bet / (pot + bet), making it the direct complement of MDF.'),

('indifference',
 'Indifference Principle',
 'game_theory',
 'advanced',
 'At equilibrium, hands played as mixed strategies yield equal EV for every action taken, meaning the bettor''s bluff frequency makes the caller indifferent to calling or folding, and vice versa.'),

('nash_equilibrium',
 'Nash Equilibrium',
 'game_theory',
 'advanced',
 'A strategy pair (GTO) where neither player can improve their EV by unilaterally changing their action, making the strategy unexploitable regardless of opponent adjustments.'),

-- Math
('pot_odds',
 'Pot Odds',
 'math',
 'beginner',
 'The ratio of the amount you must call to the total pot after your call, expressing the minimum equity your hand needs to make a call profitable; formula: pot_odds = call / (pot + call).'),

('spr_theory',
 'Stack-to-Pot Ratio (SPR)',
 'math',
 'intermediate',
 'The ratio of effective stack to pot size at the start of a street; formula: SPR = effective_stack / pot, determining commitment thresholds and which hand types (draws vs. made hands) gain or lose value.'),

-- Fundamentals / Position
('position_value',
 'Position Value',
 'fundamentals',
 'beginner',
 'The strategic advantage gained by acting last, which lets you gather information, realize equity more fully, and take free cards — IP players capture roughly 55 % of pot EV with symmetric ranges.'),

-- Strategy
('value_betting',
 'Value Betting',
 'strategy',
 'beginner',
 'Betting with a hand that is ahead of the opponent''s calling range, with the goal of getting called by worse hands to extract maximum chips over time.'),

('bluff_basics',
 'Bluff Fundamentals',
 'strategy',
 'beginner',
 'Betting with a weak hand to make a stronger hand fold, profitable only when the opponent''s fold frequency exceeds alpha (the break-even fold threshold for the bet size used).'),

('cbet_theory',
 'Continuation Betting',
 'strategy',
 'intermediate',
 'A bet made by the preflop aggressor on the flop, using merged high-frequency small bets on boards where they hold range advantage, and polarized lower-frequency larger bets where range advantage is contested.'),

('bluff_value_ratio',
 'Bluff-to-Value Ratio',
 'strategy',
 'intermediate',
 'The proportion of bluffs to value hands in a betting range; at equilibrium it equals alpha, so a pot-sized bet warrants 1 bluff combo per 1 value combo to make the defender indifferent to calling.'),

('exploit',
 'Exploitative Play',
 'strategy',
 'advanced',
 'Deliberately deviating from GTO to maximise EV against a specific opponent leak — bluffing more vs. over-folders, value-betting thinner vs. over-callers — at the cost of becoming exploitable yourself.'),

-- Ranges
('hand_ranges',
 'Hand Ranges',
 'ranges',
 'intermediate',
 'The complete set of hands a player could hold in a given situation, forming the foundation of all modern poker analysis; every strategic decision is made against a range, not a specific hand.'),

('range_advantage',
 'Range Advantage',
 'ranges',
 'intermediate',
 'When one player''s entire range has higher average equity than the opponent''s on a specific board, enabling higher c-bet frequency with smaller sizes (merged strategy) to deny equity efficiently.'),

('nut_advantage',
 'Nut Advantage',
 'ranges',
 'intermediate',
 'Holding a disproportionate share of the strongest possible hands on a given board, which justifies polarized large bets and overbets because the opponent cannot credibly represent equal strength.'),

('equity_buckets',
 'Equity Buckets',
 'ranges',
 'intermediate',
 'A classification of hands into four tiers by equity versus the opponent''s range (Strong ≥75 %, Good 50–74 %, Weak 33–49 %, Trash <33 %), used to determine optimal betting frequency and sizing.'),

-- Postflop
('board_texture',
 'Board Texture',
 'postflop',
 'beginner',
 'The structural characteristics of community cards — dryness, connectedness, suitedness, and high-card density — that determine which player''s range is favoured and which bet strategies are appropriate.'),

-- Advanced
('blockers',
 'Blocker Effects',
 'advanced',
 'advanced',
 'Cards in your hand that reduce the number of specific combinations your opponent can hold, influencing bluff-candidate selection (blocking value hands) and calling decisions (reducing villain''s value combos).'),

('polarized',
 'Polarized vs Merged Ranges',
 'advanced',
 'advanced',
 'A betting strategy that uses only the top (value) and bottom (bluffs) of a range with large sizes, contrasted with a merged strategy that bets most of the range at a small size when holding range advantage.'),

('geometric_sizing',
 'Geometric Sizing',
 'advanced',
 'advanced',
 'Choosing bet sizes across streets so the pot grows at a constant ratio, committing all effective stacks by the river; formula: bet_fraction = (final_pot / starting_pot)^(1/streets) − 1.'),

-- Equity
('equity_real',
 'Equity Realization',
 'strategy',
 'intermediate',
 'The fraction of theoretical equity a hand actually captures in play, increased by position, suitedness, and range advantage, and decreased by being out of position or holding disconnected offsuit cards.'),

-- Tournament
('icm',
 'ICM Concepts',
 'tournament',
 'advanced',
 'Independent Chip Model: converts chip counts into real-money equity, making chip preservation more valuable than chip accumulation and significantly tightening calling ranges near pay jumps.')

ON CONFLICT (id) DO UPDATE SET
  title      = EXCLUDED.title,
  domain     = EXCLUDED.domain,
  difficulty = EXCLUDED.difficulty,
  summary    = EXCLUDED.summary;


-- ============================================================
-- CONCEPT EDGES
-- ============================================================
-- edge_type values: prerequisite | related | applies_to | opposite

INSERT INTO public.concept_edges (from_concept, to_concept, edge_type, weight) VALUES

-- pot_odds is foundational for MDF
('pot_odds',        'mdf',               'prerequisite', 1.0),

-- MDF leads into indifference (mechanistic explanation)
('mdf',             'indifference',      'prerequisite', 1.0),

-- alpha and MDF are two sides of the same coin
('alpha',           'mdf',               'related',      1.0),

-- alpha directly applies to bluffing decisions
('alpha',           'bluff_basics',      'applies_to',   1.0),

-- pot odds applies when deciding to call for value
('pot_odds',        'value_betting',     'applies_to',   0.8),

-- pot odds and equity realization are companion math concepts
('pot_odds',        'equity_real',       'related',      0.8),

-- position drives range advantage in most spots
('position_value',  'range_advantage',   'related',      0.9),

-- position explains why IP c-bets so often
('position_value',  'cbet_theory',       'applies_to',   0.8),

-- hand ranges are prerequisite to range advantage
('hand_ranges',     'range_advantage',   'prerequisite', 1.0),

-- hand ranges are prerequisite to understanding nut advantage
('hand_ranges',     'nut_advantage',     'prerequisite', 1.0),

-- board texture shapes c-bet strategy directly
('board_texture',   'cbet_theory',       'applies_to',   1.0),

-- board texture determines which range has advantage
('board_texture',   'range_advantage',   'related',      0.9),

-- range advantage and nut advantage are related but distinct
('range_advantage', 'nut_advantage',     'related',      0.9),

-- range advantage is the primary driver of c-bet strategy
('range_advantage', 'cbet_theory',       'applies_to',   1.0),

-- nut advantage justifies polarized strategies
('nut_advantage',   'polarized',         'applies_to',   1.0),

-- SPR and equity realization are intertwined math concepts
('spr_theory',      'equity_real',       'related',      0.9),

-- SPR determines how strong a hand needs to be to value bet
('spr_theory',      'value_betting',     'applies_to',   0.8),

-- equity realization decomposes into equity buckets
('equity_real',     'equity_buckets',    'related',      0.8),

-- equity buckets inform bluff-to-value ratio construction
('equity_buckets',  'bluff_value_ratio', 'related',      0.8),

-- bluff basics is required knowledge before ratio thinking
('bluff_basics',    'bluff_value_ratio', 'prerequisite', 1.0),

-- bluff basics relies on alpha to determine profitability
('bluff_basics',    'alpha',             'applies_to',   1.0),

-- value betting and bluff ratio are two sides of range construction
('value_betting',   'bluff_value_ratio', 'related',      0.8),

-- bluff-to-value ratio is a prerequisite for polarized range building
('bluff_value_ratio','polarized',        'prerequisite', 1.0),

-- c-bet sizing is informed by geometric sizing theory
('cbet_theory',     'geometric_sizing',  'applies_to',   0.7),

-- polarized ranges require blockers to select best bluffs
('polarized',       'blockers',          'applies_to',   0.8),

-- blockers and nut advantage are related (blocking the nuts)
('blockers',        'nut_advantage',     'related',      0.7),

-- MDF is the GTO defence; exploitative play deviates from it
('mdf',             'exploit',           'opposite',     1.0),

-- Nash equilibrium and exploitative play are direct opposites
('nash_equilibrium','exploit',           'opposite',     1.0),

-- indifference is the mechanism that produces Nash equilibrium
('indifference',    'nash_equilibrium',  'related',      1.0),

-- bluff-to-value ratio achieving indifference is what creates equilibrium
('bluff_value_ratio','indifference',     'related',      0.9),

-- SPR affects ICM decisions (lower SPR = closer to all-in = ICM pressure)
('spr_theory',      'icm',               'related',      0.7)

ON CONFLICT (from_concept, to_concept, edge_type) DO UPDATE SET
  weight = EXCLUDED.weight;


-- ============================================================
-- LEARNING PATHS
-- ============================================================

INSERT INTO public.learning_paths (id, title, description, tier_required, sort_order) VALUES
('beginner',     'Foundations',   'Master the fundamentals of poker strategy',      'free',    1),
('intermediate', 'Range Thinking','Think in ranges and dominate postflop',           'pro',     2),
('advanced',     'GTO Mastery',   'Exploit-proof your game with game theory',        'premium', 3)
ON CONFLICT (id) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description;
