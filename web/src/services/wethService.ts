import { ethers, type Signer } from 'ethers';

const WETH_ABI = [
    'function deposit() payable',
    'function withdraw(uint256 wad)',
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)'
];

const WETH_ADDRESSES: { [chainId: number]: string } = {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',      // Mainnet
    11155111: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // Sepolia
    100: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',     // Gnosis
    42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',   // Arbitrum
    8453: '0x4200000000000000000000000000000000000006',    // Base
};

export class WethService {
    private signer: Signer;
    private chainId: number;

    constructor(signer: Signer, chainId: number) {
        this.signer = signer;
        this.chainId = chainId;
    }

    private getWethAddress(): string {
        const address = WETH_ADDRESSES[this.chainId];
        if (!address) {
            throw new Error(`WETH address not found for chain ID ${this.chainId}`);
        }
        return address;
    }

    async wrap(amount: string): Promise<string> {
        const wethAddress = this.getWethAddress();
        const contract = new ethers.Contract(wethAddress, WETH_ABI, this.signer);

        const tx = await contract.deposit({
            value: ethers.parseEther(amount)
        });

        console.log('Wrap transaction sent:', tx.hash);
        const receipt = await tx.wait();
        return receipt.hash;
    }

    async unwrap(amount: string): Promise<string> {
        const wethAddress = this.getWethAddress();
        const contract = new ethers.Contract(wethAddress, WETH_ABI, this.signer);

        const tx = await contract.withdraw(ethers.parseEther(amount));

        console.log('Unwrap transaction sent:', tx.hash);
        const receipt = await tx.wait();
        return receipt.hash;
    }
}
