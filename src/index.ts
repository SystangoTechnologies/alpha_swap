import { CowBot } from './cowSdk';
import { SupportedChainId } from '@cowprotocol/cow-sdk';

const args = process.argv.slice(2);
const networkArgIndex = args.indexOf('--network');
let chainId = SupportedChainId.MAINNET;
let rpcUrl = undefined;

if (networkArgIndex !== -1) {
    const network = args[networkArgIndex + 1];
    if (network === 'sepolia') {
        chainId = SupportedChainId.SEPOLIA;
        rpcUrl = 'https://rpc.ankr.com/eth_sepolia';
    }
    // Remove network args so they don't interfere with command parsing
    args.splice(networkArgIndex, 2);
}

const bot = new CowBot(chainId, rpcUrl);

async function main() {
    const command = args[0];

    if (!command) {
        console.log('Usage:');
        console.log('  npm start buy <tokenBuy> <tokenSell> <amountBuy> [buyDecimals] [sellDecimals]');
        console.log('  npm start sell <tokenSell> <tokenBuy> <amountSell> [sellDecimals] [buyDecimals]');
        console.log('  npm start limit <tokenSell> <tokenBuy> <amountSell> <minBuyAmount> [sellDecimals] [buyDecimals]');
        return;
    }

    try {
        if (command === 'buy') {
            const [_, tokenBuy, tokenSell, amountBuy, buyDecimalsStr, sellDecimalsStr] = args;
            console.log('Args:', args);
            if (!tokenBuy || !tokenSell || !amountBuy) {
                throw new Error('Missing arguments for buy command');
            }
            const buyDecimals = (buyDecimalsStr && !isNaN(parseInt(buyDecimalsStr))) ? parseInt(buyDecimalsStr) : 18;
            const sellDecimals = (sellDecimalsStr && !isNaN(parseInt(sellDecimalsStr))) ? parseInt(sellDecimalsStr) : 18;

            console.log(`Fetching quote to BUY ${amountBuy} ${tokenBuy} with ${tokenSell}...`);
            const orderId = await bot.placeOrder(tokenSell, tokenBuy, amountBuy, 'buy', sellDecimals, buyDecimals);
            console.log(`Order placed! ID: ${orderId}`);

        } else if (command === 'sell') {
            const [_, tokenSell, tokenBuy, amountSell, sellDecimalsStr, buyDecimalsStr] = args;
            if (!tokenSell || !tokenBuy || !amountSell) {
                throw new Error('Missing arguments for sell command');
            }
            const sellDecimals = sellDecimalsStr ? parseInt(sellDecimalsStr) : 18;
            const buyDecimals = buyDecimalsStr ? parseInt(buyDecimalsStr) : 18;

            console.log(`Fetching quote to SELL ${amountSell} ${tokenSell} for ${tokenBuy}...`);
            const orderId = await bot.placeOrder(tokenSell, tokenBuy, amountSell, 'sell', sellDecimals, buyDecimals);
            console.log(`Order placed! ID: ${orderId}`);

        } else if (command === 'limit') {
            const [_, tokenSell, tokenBuy, amountSell, minBuyAmount, sellDecimalsStr, buyDecimalsStr] = args;
            if (!tokenSell || !tokenBuy || !amountSell || !minBuyAmount) {
                throw new Error('Missing arguments for limit command');
            }
            const sellDecimals = sellDecimalsStr ? parseInt(sellDecimalsStr) : 18;
            const buyDecimals = buyDecimalsStr ? parseInt(buyDecimalsStr) : 18;

            console.log(`Placing LIMIT order to SELL ${amountSell} ${tokenSell} for at least ${minBuyAmount} ${tokenBuy}...`);
            const orderId = await bot.placeOrder(tokenSell, tokenBuy, amountSell, 'sell', sellDecimals, buyDecimals, minBuyAmount);
            console.log(`Limit Order placed! ID: ${orderId}`);

        } else {
            console.log('Unknown command');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
