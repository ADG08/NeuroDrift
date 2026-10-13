// Perceptron multicouche : chaque neurone fait la somme pondérée des sorties de la couche précédente,
// ajoute son biais, puis passe le résultat dans tanh. Pas de librairie : tout le calcul est ici.
export class NeuralNetwork {
    // Nombre de neurones par couche, entrées comprises. Ex. [8, 8, 4].
    readonly layerSizes: number[];
    // Tous les poids et biais à plat, couche après couche, neurone après neurone :
    // c'est le « génome » que l'évolution fera varier.
    readonly weights: Float64Array;
    // Valeurs de chaque couche lors du dernier predict (entrées comprises) : pour visualiser le réseau en action.
    activations: number[][] = [];

    constructor(layerSizes: number[], weights: Float64Array) {
        const expected = NeuralNetwork.parameterCount(layerSizes);
        if (weights.length !== expected) {
            throw new Error(`${weights.length} poids fournis, ${expected} attendus pour [${layerSizes}]`);
        }
        this.layerSizes = layerSizes;
        this.weights = weights;
    }

    // Chaque neurone a un poids par neurone de la couche précédente, plus un biais.
    static parameterCount(layerSizes: number[]): number {
        let count = 0;
        for (let layer = 1; layer < layerSizes.length; layer++) {
            count += (layerSizes[layer - 1] + 1) * layerSizes[layer];
        }
        return count;
    }

    static random(layerSizes: number[]): NeuralNetwork {
        const weights = Float64Array.from({length: NeuralNetwork.parameterCount(layerSizes)}, () => Math.random() * 2 - 1);
        return new NeuralNetwork(layerSizes, weights);
    }

    // Propagation avant : les entrées traversent les couches une à une. Chaque sortie est dans ]-1, 1[.
    predict(inputs: number[]): number[] {
        if (inputs.length !== this.layerSizes[0]) {
            throw new Error(`${inputs.length} entrées fournies, ${this.layerSizes[0]} attendues`);
        }

        let activations = inputs;
        this.activations = [inputs];
        let w = 0;
        for (let layer = 1; layer < this.layerSizes.length; layer++) {
            const outputs = new Array<number>(this.layerSizes[layer]);
            for (let neuron = 0; neuron < outputs.length; neuron++) {
                let sum = 0;
                for (const activation of activations) sum += activation * this.weights[w++];
                sum += this.weights[w++]; // biais
                outputs[neuron] = Math.tanh(sum);
            }
            activations = outputs;
            this.activations.push(outputs);
        }
        return activations;
    }
}
