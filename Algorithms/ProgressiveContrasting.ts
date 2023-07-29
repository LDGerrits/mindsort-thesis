/**
 * @file
 * This implements various classes for handling items in an item-pair contrasting system.
 * It provides structures for handling items, computing levenshtein distances, and two contrasting algorithms:
 * a static and an adaptive one.
 *
 * The system works by comparing and contrasting item pairs. These item pairs are analyzed based on 
 * levenshtein distances to identify similarity levels.
 *
 * The contrasting algorithms generate a list of item pairs to be compared. 
 * They work in rounds, contrasting a number of items in each round.
 *
 * The StaticContrastingAlgorithm selects items for comparison that are very similar to each other.
 * The AdaptiveContrastingAlgorithm adjusts the level of contrasting dynamically based on the user's skill,
 * so the words differ a lot at first but as the user's skill increases the selected items become increasingly similar.
 */

import { assert } from 'console';
import ItemPair from '../core/item';
import levenshtein, { levenshteinDistance } from '../../common/algorithms/distance/levenshtein';
import { GameState } from '../core/game';

/**
 * A wrapper class for ItemPair to include other data
 */
class Item {
    private _itemPair: ItemPair;
    private _levenshteinDistances: ItemPair[][];
    private _contrastingLevel: number;
    private _countSeen: number;

    /**
     * @constructor
     * @param {ItemPair} itemPair - The ItemPair object.
     * @param {ItemPair[][]} levenshteinDistances - The 2D array of Levenshtein distances between item pairs.
     */
    constructor(itemPair: ItemPair, levenshteinDistances: ItemPair[][] ) {
        this._itemPair = itemPair;
        this._countSeen = 0;
        this._contrastingLevel = 0;
        this._levenshteinDistances = levenshteinDistances;
    }
    get itemPair(): ItemPair {
        return this._itemPair;
    }
    get countSeen(): number {
        return this._countSeen;
    }
    set countSeen(value: number) {
        this._countSeen = value;
    }
    get contrastingLevel(): number {
        return this._contrastingLevel;
    }
    set contrastingLevel(value: number) {
        this._contrastingLevel = value;
    }
    get levenshteinDistances(): ItemPair[][] {
        return this._levenshteinDistances;
    }
}

/**
 * @abstract
 * @class Contrasting
 * @description This abstract class represents the core contrasting algorithm with properties for the items being compared,
 * their contrasting level, and tracking of progress.
 */
export default abstract class Contrasting {
    private _gameState: GameState;
    private _items: Item[]; //list of all unique Items in a random order
    private _currentItemIndex: number; //the index number of the current item
    private _currentRound: number; //the number of the current round
    private _maxRounds: number; //the max number of rounds
    private _nrContrastedItems: number; //the number of items that are contrasted for each trial
    private _nrTotalItems: number; //the number of items that are contrasted for each trial

    constructor(gameState: GameState, maxRounds: number, nrContrastedItems: number) {
        this._gameState = gameState;
        this._currentItemIndex = 0;
        this._currentRound = 0;
        this._maxRounds = maxRounds - 1;
        this._nrContrastedItems = nrContrastedItems;
        this._nrTotalItems = gameState.itemPairs.length;
        this._items = this.initializeItems(gameState.itemPairs);
    }
    get gameState(): GameState {
        return this._gameState;
    }
    get items(): Item[] {
        return this._items;
    }
    set items(value: Item[]){
        this._items = value;
    }
    set currentItemIndex(value: number){
        this._currentItemIndex = value;
    }
    get currentItemIndex(): number {
        return this._currentItemIndex;
    }
    get currentRound(): number {
        return this._currentRound;
    }
    set currentRound(value: number) {
        this._currentRound = value;
    }
    get maxRounds(): number {
        return this._maxRounds;
    }
    get nrContrastedItems(): number {
        return this._nrContrastedItems;
    }
    get nrTotalItems(): number {
        return this._nrTotalItems;
    }

    /**
     * This method is responsible for initializing the _items array by creating 
     * an Item for each ItemPair in the given array, then shuffling these items.
     *
     * @param itemPairs - An array of ItemPairs to be used for initializing the _items array.
     * @returns An array of Items, shuffled in random order.
     */
    initializeItems(itemPairs: ItemPair[]): Item[] {
        let items: Item[] = itemPairs.map(itemPair => new Item(itemPair, this.computeNormalizedLevenshteinDistances(itemPair, itemPairs)));
        items = this.shuffleItems(items);
        return items;
    }

    /**
     * This method is responsible for computing the normalized Levenshtein distance between an item pair and an array of item pairs.
     * The distance measures are categorized into three parts: dissimilar (distance > 0.4), somewhat similar (0.15 < distance <= 0.4),
     * and very similar (distance <= 0.15).
     *
     * @param itemPair - The ItemPair to compare to the array of ItemPairs.
     * @param itemPairs - The array of ItemPairs to compare to the ItemPair.
     * @returns An array of ItemPairs sorted by similarity in descending order.
     */
    computeNormalizedLevenshteinDistances(itemPair: ItemPair, itemPairs: ItemPair[]): ItemPair[][] {
        let levenshteinDistances = new Map<ItemPair, number>();
        let minDistance = Infinity;
        let maxDistance = -Infinity;

        itemPairs.forEach( (object, index) => {
            if (object !== itemPair) {
                let distance = levenshteinDistance(itemPair.to, object.to);
                levenshteinDistances.set(object, distance);

                if(distance < minDistance) {
                    minDistance = distance;
                }

                if(distance > maxDistance) {
                    maxDistance = distance;
                }
            }
        });

        levenshteinDistances.forEach((value, key, map) => {
            // Handles the special case when maxDistance is equal to minDistance, which would result in a division by zero.
            if(maxDistance === minDistance){
                map.set(key, 1);
            } else {
                map.set(key, (value - minDistance) / (maxDistance - minDistance));
            }
        });

        // Convert the map to an array of [key, value] pairs
        let array = Array.from(levenshteinDistances.entries());

        // Filter the array into three parts based on the value
        let part1 = array.filter(([key, value]) => value > 0.5 && value <= 1).map(tuple => tuple[0]); // Dissimilar
        let part2 = array.filter(([key, value]) => value > 0.2 && value <= 0.5).map(tuple => tuple[0]); // Somewhat Similar
        let part3 = array.filter(([key, value]) => value >= 0 && value <= 0.2).map(tuple => tuple[0]); // Very Similar

        return [part1, part2, part3];
    }

    /**
     * This method is responsible for randomly shuffling an array of items.
     *
     * @param items - An array of Items to be shuffled.
     * @returns An array of Items, shuffled in random order.
     */
    shuffleItems(items: Item[]): Item[] {
        return items
        .map((value) => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value);
    }

    /**
     * This method is responsible for searching for an Item in the _items array 
     * with a matching ItemPair and returning it, or returning null if not found.
     *
     * @param itemPair - The ItemPair to find the corresponding Item for.
     * @returns The matching Item, or null if not found.
     */
    getItemFromItemPair(itemPair: ItemPair): Item | null {
        const item = this.items.find((item) => {
            return item.itemPair === itemPair;
        });
        return item !== undefined ? item : null;
    }

    /**
     * This method is responsible for obtaining an ItemPair with a specified contrasting level.
     * If no ItemPair is found at the starting contrasting level, it will attempt to find an 
     * ItemPair at lower contrasting levels down to level 0.
     *
     * @param currentItem - The current Item.
     * @param startingContrastingLevel - The initial contrasting level to look for an ItemPair.
     * @returns An ItemPair with a specified contrasting level.
     */
    getItemPairOfContrastingLevel(currentItem: Item, startingContrastingLevel: number): ItemPair {
        for (let i = startingContrastingLevel; i >= 0; i--) {
            if (currentItem.levenshteinDistances[i].length !== 0) {
                return this.getLeastSeenItemPair(currentItem.levenshteinDistances[i]);
            }
        }

        return this.getLeastSeenItemPair(currentItem.levenshteinDistances[0]);
    }

    /**
     * This method is responsible for finding an overlapping ItemPair between two Items
     * at a specified contrasting level. If no overlapping ItemPair is found at the starting 
     * contrasting level, it will attempt to find an overlapping ItemPair at lower contrasting 
     * levels down to level 0.
     *
     * @param item1 - The first Item.
     * @param item2 - The second Item.
     * @param startingContrastingLevel - The initial contrasting level to look for an overlapping ItemPair.
     * @returns An overlapping ItemPair between two Items at a specified contrasting level.
     */
    getOverlappingItempair(item1: Item, item2: Item, startingContrastingLevel: number): ItemPair {
        for (let i = startingContrastingLevel; i >= 0; i--) {
            let inCommonItemPair = item1.levenshteinDistances[i].filter(value => item2.levenshteinDistances[i].includes(value));
            if (inCommonItemPair.length !== 0) {
                return this.getLeastSeenItemPair(inCommonItemPair);
            }
        }

        return this.getLeastSeenItemPair(item1.levenshteinDistances[0]);
    }

    /**
     * This method is responsible for finding the least seen ItemPair from the list of ItemPairs.
     * The "least seen" is determined by the number of times an ItemPair has been contrasted against.
     * If multiple ItemPairs have the same lowest number of times contrasted, one of them is selected randomly.
     *
     * @returns The least seen ItemPair. If all ItemPairs have been seen an equal number of times, a random ItemPair is returned.
     */
    getLeastSeenItemPair(itemPairs: ItemPair[]): ItemPair {
        return itemPairs.reduce((lowestCountItemPair, currentItemPair) => {
            let lowestCountItem = this.getItemFromItemPair(lowestCountItemPair);
            let currentCountItem = this.getItemFromItemPair(currentItemPair);
            if (lowestCountItem && currentCountItem && currentCountItem.countSeen < lowestCountItem.countSeen) {
                return currentItemPair;
            }
            return lowestCountItemPair;
        }, 
            itemPairs[0]
        );
    }
}

/**
 * @class StaticContrastingAlgorithm
 * @extends Contrasting
 * @description This class represents a static contrasting algorithm that extends the base Contrasting class.
 */
export class StaticContrastingAlgorithm extends Contrasting {
    private initialized: boolean;

    constructor(gameState: GameState, nrOfRounds: number) {
        super(gameState, nrOfRounds, 3);

        this.initialized = false;
    }

    /**
     * @method updateToDo
     * @description Returns a list of three ItemPairs where the first ItemPair at index 0 is the answer.
     * @returns {ItemPair[]} - An array of three ItemPairs.
     */
    updateToDo(): ItemPair[] {

        if (this.initialized) {
            // Check if a new round starts
            if (this.currentItemIndex === 0) {
                this.currentRound = this.currentRound + 1;

                if (this.currentRound > this.maxRounds) {
                    return [];
                }

                this.items = this.shuffleItems(this.items);
            }
        } else {
            this.initialized = true;
        }

        const todo : ItemPair[] = [];

        const currentItem = this.items[this.currentItemIndex];
        currentItem.countSeen += 1;
        todo.push(currentItem.itemPair);

        let secondItem = this.getItemFromItemPair(this.getItemPairOfContrastingLevel(currentItem, 2))!;
        secondItem.countSeen += 1;
        todo.push(secondItem.itemPair);

        let thirdItem = this.getItemFromItemPair(this.getOverlappingItempair(currentItem, secondItem, 2))!;
        thirdItem.countSeen += 1;
        todo.push(thirdItem.itemPair);

        this.gameState.customData.set("contrastingLevel", 2);
        this.gameState.customData.set("contrastedItemPairs", todo);

        // Update the index for the next update
        this.currentItemIndex = (this.currentItemIndex + 1) % this.nrTotalItems;

        return todo;
    }
}

/**
 * @class ProgressiveContrastingAlgorithm
 * @extends Contrasting
 * @description This class represents a progressive contrasting algorithm that extends the base Contrasting class.
 */
export class ProgressiveContrastingAlgorithm extends Contrasting {
    private contrastingLevels: number[];
    private initialized: boolean;

    constructor(gameState: GameState, nrOfRounds: number, contrastingLevels: number[]) {
        super(gameState, nrOfRounds, 3);

        this.contrastingLevels = contrastingLevels;
        this.initialized = false;
    }

     /**
     * @method updateToDo
     * @description Returns a list of three ItemPairs where the first ItemPair at index 0 is the answer. The function also adjusts the contrasting level based on the correctness of the answer.
     * @returns {ItemPair[]} - An array of three ItemPairs.
     */
     updateToDo(): ItemPair[] {

        if (this.initialized) {
            // Check if a new round starts
            if (this.currentItemIndex === 0) {
                this.currentRound = this.currentRound + 1;

                if (this.currentRound > this.maxRounds) {
                    return [];
                }

                this.items = this.shuffleItems(this.items);
            }
        } else {
            this.initialized = true;
        }

        const todo : ItemPair[] = [];

        const currentItem = this.items[this.currentItemIndex];
        currentItem.countSeen += 1;
        todo.push(currentItem.itemPair);

        let secondItem = this.getItemFromItemPair(this.getItemPairOfContrastingLevel(currentItem, this.contrastingLevels[this.currentRound]))!;
        secondItem.countSeen += 1;
        todo.push(secondItem.itemPair);

        let thirdItem = this.getItemFromItemPair(this.getOverlappingItempair(currentItem, secondItem, this.contrastingLevels[this.currentRound]))!;
        thirdItem.countSeen += 1;
        todo.push(thirdItem.itemPair);

        this.gameState.customData.set("contrastingLevel", this.contrastingLevels[this.currentRound]);
        this.gameState.customData.set("contrastedItemPairs", todo);

        // Update the index for the next update
        this.currentItemIndex = (this.currentItemIndex + 1) % this.nrTotalItems;

        return todo;
    }
}
