export function parseInfoLine(line) {
    if (!line.startsWith('info')) {
        return null;
    }
    const tokens = line.trim().split(/\s+/g);
    const info = {};
    for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        switch (token) {
            case 'depth': {
                const next = tokens[++i];
                if (next)
                    info.depth = Number.parseInt(next, 10);
                break;
            }
            case 'seldepth': {
                const next = tokens[++i];
                if (next)
                    info.seldepth = Number.parseInt(next, 10);
                break;
            }
            case 'multipv': {
                const next = tokens[++i];
                if (next)
                    info.multipv = Number.parseInt(next, 10);
                break;
            }
            case 'score': {
                const type = tokens[++i];
                const valueToken = tokens[++i];
                if (type === 'cp' && valueToken) {
                    info.score = { type: 'cp', value: Number.parseInt(valueToken, 10) };
                }
                else if (type === 'mate' && valueToken) {
                    info.score = { type: 'mate', value: Number.parseInt(valueToken, 10) };
                }
                break;
            }
            case 'pv': {
                const rest = tokens.slice(i + 1);
                info.pv = rest;
                i = tokens.length; // exit loop
                break;
            }
            case 'nps': {
                const next = tokens[++i];
                if (next)
                    info.nps = Number.parseInt(next, 10);
                break;
            }
            case 'nodes': {
                const next = tokens[++i];
                if (next)
                    info.nodes = Number.parseInt(next, 10);
                break;
            }
            default:
                // skip unknown token by continuing
                break;
        }
    }
    return info;
}
export function parseBestMoveLine(line) {
    if (!line.startsWith('bestmove'))
        return null;
    const tokens = line.trim().split(/\s+/g);
    const bestmove = tokens[1];
    if (!bestmove)
        return null;
    const ponderIndex = tokens.indexOf('ponder');
    return {
        bestmove,
        ponder: ponderIndex !== -1 ? tokens[ponderIndex + 1] : undefined,
    };
}
export function scoreToNumber(score) {
    if (!score)
        return null;
    if (score.type === 'cp')
        return score.value;
    // mate scores: closer mate -> larger magnitude; we map sign preserving.
    const mateSign = score.value > 0 ? 1 : -1;
    const distance = Math.abs(score.value);
    return mateSign * (100000 - distance * 1000);
}
export function invertScore(score) {
    if (!score)
        return undefined;
    if (score.type === 'cp') {
        return { type: 'cp', value: -score.value };
    }
    return { type: 'mate', value: -score.value };
}
export function cloneScore(score) {
    if (!score)
        return undefined;
    return score.type === 'cp'
        ? { type: 'cp', value: score.value }
        : { type: 'mate', value: score.value };
}
