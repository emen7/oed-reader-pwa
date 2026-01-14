// OED Entry Parser
// Converts raw OCR text into structured OED entry objects with
// completeness and overflow heuristics.

function parseOEDEntry(rawText) {
    if (!rawText || rawText.trim().length < 10) return null;

    const lines = rawText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    const entry = {
        headword: '',
        pronunciation: '',
        partOfSpeech: '',
        etymology: '',
        etymologySource: '',
        senses: [],
        rawText: rawText,
        isComplete: true,
        continuationNeeded: false,
        overflowLikely: false
    };

    let currentSection = 'header';
    let currentSenseText = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Headword guess: first "word-like" line that is not obviously etymology.
        // Relaxed for OCR errors: allow numbers, some punctuation
        if (!entry.headword && i <= 5) {
            const candidate = line.replace(/^[*†]+/, '').trim();
            // More lenient: just needs to start with letter and be reasonable length
            if (/^[A-Za-z]/.test(candidate) &&
                candidate.length >= 2 &&
                candidate.length <= 50 &&
                !candidate.toLowerCase().includes('etymolog') &&
                !candidate.toLowerCase().includes('pronunciation')) {
                entry.headword = candidate;
                console.log('Found headword:', candidate);
                continue;
            }
        }

        // Pronunciation line (very heuristic: brackets or slashes, early in entry).
        if (!entry.pronunciation &&
            (line.startsWith('[') || line.startsWith('(') || line.includes('/'))) {
            entry.pronunciation = line;
            continue;
        }

        // Part of speech.
        const posMatch = line.match(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|interj\.)/i);
        if (posMatch && !entry.partOfSpeech) {
            entry.partOfSpeech = posMatch[1];
            continue;
        }

        // Etymology trigger – crude but useful.
        if (line.toLowerCase().startsWith('etym') ||
            line.toLowerCase().includes('from ') ||
            line.toLowerCase().includes('f. ') ||
            line.toLowerCase().includes('fr. ')) {
            currentSection = 'etymology';
            if (!entry.etymologySource) {
                entry.etymologySource = extractEtymologySource(line);
            }
            entry.etymology += (entry.etymology ? ' ' : '') + line;
            continue;
        }

        // Sense number like "1." "2." etc.
        const senseMatch = line.match(/^(\d+)\.\s*(.*)/);
        if (senseMatch) {
            if (currentSenseText) {
                entry.senses.push(parseSense(currentSenseText));
                currentSenseText = '';
            }
            currentSection = 'sense';
            currentSenseText = senseMatch[2] || '';
            continue;
        }

        // Accumulate.
        if (currentSection === 'etymology') {
            entry.etymology += (entry.etymology ? ' ' : '') + line;
        } else if (currentSection === 'sense') {
            currentSenseText += (currentSenseText ? ' ' : '') + line;
        }
    }

    if (currentSenseText) {
        entry.senses.push(parseSense(currentSenseText));
    }

    // Trim & limit.
    entry.etymology = entry.etymology.slice(0, 800);
    entry.senses = entry.senses.slice(0, 8);

    if (!entry.headword || entry.headword.length < 2) return null;

    // Heuristics for completeness and overflow.
    detectCompletenessAndOverflow(entry);

    return entry;
}

function detectCompletenessAndOverflow(entry) {
    const text = entry.rawText.trim();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lastLine = lines[lines.length - 1] || '';

    // Assume incomplete if:
    // - Last line lacks terminal punctuation.
    // - Last token is hyphen.
    // - Odd number of double quotes.
    // - Very short last sense for short headword.
    const endsProperly = /[.;?!:)\]]$/.test(lastLine);
    const endsWithHyphen = /-$/.test(lastLine);
    const quoteCount = (text.match(/"/g) || []).length;
    const unclosedQuote = quoteCount % 2 !== 0;

    let shortLastSense = false;
    if (entry.senses.length > 0) {
        const lastSense = entry.senses[entry.senses.length - 1];
        shortLastSense = lastSense.definition && lastSense.definition.length < 30;
    }

    const likelyIncomplete =
        !endsProperly ||
        endsWithHyphen ||
        unclosedQuote ||
        (entry.headword.length <= 6 && entry.senses.length <= 1 && shortLastSense);

    entry.isComplete = !likelyIncomplete;
    entry.continuationNeeded = likelyIncomplete;

    // Overflow to adjacent column if we have several senses but short final text.
    entry.overflowLikely = !likelyIncomplete && shortLastSense && entry.senses.length >= 2;
}

function extractEtymologySource(line) {
    const sources = [
        'Latin','Greek','Old French','Old English','Middle English',
        'Proto-Germanic','Germanic','Sanskrit','Arabic','Hebrew','French','German'
    ];
    for (const s of sources) {
        if (line.toLowerCase().includes(s.toLowerCase())) return s;
    }
    return '';
}

function parseSense(senseText) {
    const sense = { definition: '', quotations: [] };

    const quoteMatch = senseText.match(/"([^"]{20,200})"/);
    if (quoteMatch) {
        sense.quotations.push(quoteMatch[1]);
        sense.definition = senseText.replace(/"([^"]{20,200})"/, '').trim();
    } else {
        sense.definition = senseText.slice(0, 400);
    }

    return sense;
}

// Abbreviation map (kept small; extend as needed).
const oedAbbreviations = {
    'n.': 'noun',
    'v.': 'verb',
    'adj.': 'adjective',
    'adv.': 'adverb',
    'prep.': 'preposition',
    'conj.': 'conjunction',
    'pron.': 'pronoun',
    'interj.': 'interjection',
    'a.': 'adjective',
    'absol.': 'absolute',
    'attrib.': 'attributive',
    'Sc.': 'Scottish',
    'arch.': 'archaic',
    'obs.': 'obsolete',
    'poet.': 'poetic',
    'dial.': 'dialect',
    'fig.': 'figurative',
    'hist.': 'historical',
    'ME.': 'Middle English',
    'OE.': 'Old English',
    'OF.': 'Old French',
    'ON.': 'Old Norse',
    'L.': 'Latin',
    'Gr.': 'Greek',
    'Gmc.': 'Germanic',
    'prob.': 'probably',
    'perh.': 'perhaps',
    'app.': 'apparently',
    'var.': 'variant'
};

function getAbbreviationTooltip(abbrev) {
    return oedAbbreviations[abbrev] || abbrev;
}
