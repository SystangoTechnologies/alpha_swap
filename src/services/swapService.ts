import { ISwapAdapter, QuoteParams, OrderParams } from '../adapters/interfaces/ISwapAdapter';
import { CowSwapAdapter } from '../adapters/cowSwapAdapter';
import { getSupportedChainId } from '../config/chains';

export class SwapService {
    private adapter: ISwapAdapter;

    constructor(chainId: number = 1) {
        // Map chainId number to SupportedChainId using helper
        const supportedChainId = getSupportedChainId(chainId);

        if (!supportedChainId) {
            throw new Error(`Unsupported chainId: ${chainId}`);
        }

        this.adapter = new CowSwapAdapter(supportedChainId);
    }

    async getQuote(params: QuoteParams) {
        return this.adapter.getQuote(params);
    }

    async submitOrder(params: OrderParams) {
        return this.adapter.submitOrder(params);
    }
}
