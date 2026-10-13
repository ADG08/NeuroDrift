// Algorithme génétique : à partir des génomes d'une génération et de leurs scores, fabrique la suivante.

const ELITE_COUNT = 2;
const TOURNAMENT_SIZE = 3;
const MUTATION_RATE = 0.1;
const MUTATION_STRENGTH = 0.4;

export interface Scored {
    genome: Float64Array;
    fitness: number;
}

export function nextGeneration(population: Scored[]): Float64Array[] {
    const ranked = [...population].sort((a, b) => b.fitness - a.fitness);

    // Élitisme : les meilleurs passent tels quels, la génération suivante ne peut pas faire pire.
    const next: Float64Array[] = ranked.slice(0, ELITE_COUNT).map(({genome}) => genome.slice());
    while (next.length < population.length) {
        const child = crossover(tournament(ranked).genome, tournament(ranked).genome);
        next.push(mutate(child));
    }
    return next;
}

// Sélection par tournoi : on tire quelques individus au hasard et on garde le meilleur.
// Les bons ont plus de chances d'être parents, sans que les autres soient totalement exclus.
function tournament(population: Scored[]): Scored {
    let best = population[Math.floor(Math.random() * population.length)];
    for (let i = 1; i < TOURNAMENT_SIZE; i++) {
        const challenger = population[Math.floor(Math.random() * population.length)];
        if (challenger.fitness > best.fitness) best = challenger;
    }
    return best;
}

// Croisement uniforme : chaque gène vient de l'un ou l'autre parent, à pile ou face.
function crossover(a: Float64Array, b: Float64Array): Float64Array {
    return a.map((gene, i) => (Math.random() < 0.5 ? gene : b[i]));
}

// Mutation : quelques gènes reçoivent un petit décalage aléatoire, pour explorer de nouveaux comportements.
function mutate(genome: Float64Array): Float64Array {
    for (let i = 0; i < genome.length; i++) {
        if (Math.random() < MUTATION_RATE) genome[i] += gaussian() * MUTATION_STRENGTH;
    }
    return genome;
}

// Loi normale centrée réduite (transformée de Box-Muller) : la plupart des décalages sont petits, quelques-uns grands.
function gaussian(): number {
    return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}
