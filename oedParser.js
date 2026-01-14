// OED Entry Parser
// Converts raw OCR text into structured OED entry objects

function parseOEDEntry(rawText) {
    if (!rawText || rawText.trim().length < 10) {
        return null;
    }

    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const entry = {
        headword: '',
        pronunciation: '',
        partOfSpeech: '',
        etymology: '',
        etymologySource: '',
        senses: [],
        rawText: rawText
    };

    let currentSection = 'header';
    let currentSenseText = '';
    let senseCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Try to identify headword (usually first substantial line, often ALL CAPS or bold-like)
        if (i === 0 || (entry.headword === '' && line.length > 1 && line.length < 50)) {
            // Remove common OED markers
            let word = line.replace(/^\*/, '').replace(/†$/, '').trim();
            
            // Check if it looks like a headword (word chars, possibly with hyphens/apostrophes)
            if (/^[a-z\s\-']+$/i.test(word) && !line.toLowerCase().includes('etymology')) {
                entry.headword = word;
                continue;
            }
        }

        // Pronunciation (usually in brackets or after headword)
        if (line.match(/^\(/i) || line.match(/^\\[.*\\]/)) {
            entry.pronunciation = line.replace(/^\(/, '').replace(/\)$/, '').trim();
            continue;
        }

        // Part of speech abbreviations
        const posMatch = line.match(/^(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|interj\.)/i);
        if (posMatch) {
            entry.partOfSpeech = posMatch[1];
            continue;
        }

        // Etymology marker
        if (line.toLowerCase().includes('etymology') || line.toLowerCase().includes('from')) {
            currentSection = 'etymology';
            entry.etymologySource = extractEtymologySource(line);
            continue;
        }

        // Sense numbers (1, 2, 3, etc. - often alone or followed by definition)
        const senseMatch = line.match(/^(\d+)\.\s*(.*)/);
        if (senseMatch) {
            if (currentSenseText) {
                entry.senses.push(parseSense(currentSenseText));
            }
            currentSection = 'sense';
            senseCount = parseInt(senseMatch[1]);
            currentSenseText = senseMatch[2] || '';
            continue;
        }

        // Accumulate text based on section
        if (currentSection === 'etymology') {
            entry.etymology += (entry.etymology ? ' ' : '') + line;
        } else if (currentSection === 'sense') {
            currentSenseText += (currentSenseText ? ' ' : '') + line;
        }
    }

    // Don't forget the last sense
    if (currentSenseText) {
        entry.senses.push(parseSense(currentSenseText));
    }

    // Clean up
    entry.etymology = entry.etymology.substring(0, 500); // Limit length
    entry.senses = entry.senses.slice(0, 5); // Limit to 5 senses

    // Validate
    if (!entry.headword || entry.headword.length < 2) {
        return null;
    }

    return entry;
}

function extractEtymologySource(line) {
    // Try to identify source language from etymology line
    const sources = ['Latin', 'Greek', 'Old French', 'Proto-Germanic', 'Sanskrit', 'Arabic', 'Hebrew', 'Germanic', 'French'];
    for (let source of sources) {
        if (line.toLowerCase().includes(source.toLowerCase())) {
            return source;
        }
    }
    return '';
}

function parseSense(senseText) {
    const sense = {
        definition: '',
        quotations: []
    };

    // Look for quotations (usually in quotes or after semicolons)
    const quoteMatch = senseText.match(/"([^"]{20,200})"/);
    if (quoteMatch) {
        sense.quotations.push(quoteMatch[1]);
        sense.definition = senseText.replace(/"([^"]{20,200})"/, '').trim();
    } else {
        sense.definition = senseText.substring(0, 300);
    }

    return sense;
}

// OED Abbreviations reference
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
    'rare': 'rare',
    'poet.': 'poetic',
    'vulg.': 'vulgar',
    'dial.': 'dialect',
    'regional': 'regional',
    'slang': 'slang',
    'fig.': 'figurative',
    'hist.': 'historical',
    'Hist.': 'historical',
    'cf.': 'compare',
    'const.': 'construction',
    'w.': 'with',
    'pa.': 'past',
    'ppl. a.': 'participial adjective',
    'pass.': 'passive',
    'mod.': 'modern',
    'ME.': 'Middle English',
    'OE.': 'Old English',
    'OF.': 'Old French',
    'ON.': 'Old Norse',
    'L.': 'Latin',
    'Gr.': 'Greek',
    'Gmc.': 'Germanic',
    'IE.': 'Indo-European',
    'prob.': 'probably',
    'perh.': 'perhaps',
    'app.': 'apparently',
    'var.': 'variant'
};

function getAbbreviationTooltip(abbrev) {
    return oedAbbreviations[abbrev] || abbrev;
}