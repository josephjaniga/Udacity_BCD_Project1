/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persistent storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if (this.height === -1){
            console.log("INITIALIZE");
            let block = await new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
            // console.log("VALID", await block.validate());
            // console.log("DATA", await block.getBData());
        }
        console.log(this.chain);
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                let chainHeight = await self.getChainHeight();
                let previousBlock = await self.getBlockByHeight(chainHeight);
                // assign the previous hash
                if (chainHeight > -1) {
                    block.previousBlockHash = previousBlock.hash;
                }
                let newHeight = chainHeight + 1;
                // assign the height to the new block
                block.height = newHeight;
                block.time = new Date().getTime().toString().slice(0,-3);
                block.hash = await SHA256(JSON.stringify(block)).toString();
                self.height = newHeight;
                self.chain.push(block);
                let validationErrors = await this.validateChain();
                if (validationErrors.length > 0) {
                    throw new Error("BlockChain validation failed.");
                }
                resolve(block);
            } catch (e) {
                console.log(e);
                reject("_addBlock: ERROR: Unable to add new block");
            }
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve, reject) => {
            resolve(`${address}:${new Date().getTime().toString().slice(0,-3)}:starRegistry`);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Verify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                let messageTime = parseInt(message.split(':')[1]);
                let currentTime = parseInt(new Date().getTime().toString().slice(0,-3));
                let elapsedSeconds = (currentTime - messageTime);
                if ( false && elapsedSeconds > 300 ) {
                    reject("submitStar: ERROR: block created greater than 5 minutes ago");
                } else if (!bitcoinMessage.verify(message, address, signature)) {
                    // message is invalid
                    reject("submitStar: ERROR: message is invalid")
                } else {
                    // message is valid
                    // create the block?
                    let block = await new BlockClass.Block({
                        star,
                        owner: address,
                    });
                    // add it to the chain
                    resolve(await self._addBlock(block));
                }
            } catch (e) {
                reject(`submitStar: ERROR: something went wrong ${e}`);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.hash === hash)[0];
            if (block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if (block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        let self = this;
        let stars = [];
        return new Promise(async (resolve, reject) => {
            try {
                let allStars = await self.chain.slice(1).map(async (block) => {
                    let bdata = await block.getBData();
                    // console.log("bdata", bdata);
                    return {
                        owner: bdata.owner,
                        star: bdata.star,
                    };
                });
                // console.log("allStars", allStars);
                stars = await allStars.filter(async (s) => {
                    // console.log("s", s);
                    return s.owner == address;
                });
                // console.log("address", address);
                // console.log("stars", stars);
                let result = await Promise.all(stars);
                resolve(result);
            } catch (e) {
                reject(`getStarsByWalletAddress: ERROR: something went wrong ${e}`)
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
            let lastBlockHash = null;
            let isValid = false;
            for (let block of this.chain) {
                if (!block.height === 0) {
                    isValid = await block.validate();
                    if (block.previousBlockHash !== lastBlockHash) {
                        errorLog.push(`ERROR: Previous Block Hash [${lastBlockHash}] incorrect - HEIGHT: ${block.height}`)
                    }
                    if (!isValid) {
                        errorLog.push(`ERROR: This block is not valid - HEIGHT: ${block.height}`)
                    }
                }
                lastBlockHash = block.hash;
            }
            resolve(errorLog);
        });
    }

}

module.exports.Blockchain = Blockchain;   