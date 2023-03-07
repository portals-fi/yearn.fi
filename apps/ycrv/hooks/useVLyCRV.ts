import {useCallback} from 'react';
import {Contract} from 'ethcall';
import useSWR from 'swr';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {VLYCRV_TOKEN_ADDRESS, YCRV_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import {approveERC20} from '@common/utils/actions/approveToken';
import VLYCRV_ABI from '@yCRV/utils/abi/vlYCrv.abi';
import {vLyCRVDeposit, vLyCRVVote, vLyCRVVoteMany, vLyCRVWithdraw} from '@yCRV/utils/actions';

import type {KeyedMutator} from 'swr';
import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

export type TUserInfo = {
	balance: bigint;
	votesSpent: bigint;
	lastVoteTime: number;
	unlockTime: number;
}

type TGetVotesUnpacked = {
	gaugesList: string[];
	voteAmounts: bigint[];
}

type TUseVLyCRV = {
	initialData: {
		nextPeriod: number;
		userInfo: TUserInfo;
		getVotesUnpacked: TGetVotesUnpacked;
	};
	mutateData: KeyedMutator<{
		nextPeriod: number;
		userInfo: TUserInfo;
		getVotesUnpacked: TGetVotesUnpacked;
	}>;
	vote: (provider: TWeb3Provider, gaugeAddress: TAddress, votes: bigint) => Promise<TTxResponse>;
	voteMany: (provider: TWeb3Provider, gauges: TAddress[], votes: bigint[]) => Promise<TTxResponse>;
	deposit: (provider: TWeb3Provider, amount: bigint) => Promise<TTxResponse>;
	withdraw: (provider: TWeb3Provider, amount: bigint) => Promise<TTxResponse>;
	approve: (provider: TWeb3Provider, amount: bigint) => Promise<TTxResponse>;
};

const DEFAULT_VLYCRV = {
	nextPeriod: 0,
	userInfo: {
		balance: Zero,
		votesSpent: Zero,
		lastVoteTime: 0,
		unlockTime: 0
	},
	getVotesUnpacked: {
		gaugesList: [],
		voteAmounts: []
	}
};

export function useVLyCRV(): TUseVLyCRV {
	const {provider, isActive, address} = useWeb3();

	const fetcher = useCallback(async (): Promise<TUseVLyCRV['initialData']> => {
		if (!isActive || !provider) {
			return DEFAULT_VLYCRV;
		}

		const currentProvider = provider || getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const vLyCRVContract = new Contract(VLYCRV_TOKEN_ADDRESS, VLYCRV_ABI);

		const [
			nextPeriod,
			userInfo,
			getVotesUnpacked
		] = await ethcallProvider.tryAll([
			vLyCRVContract.nextPeriod(),
			vLyCRVContract.userInfo(address),
			vLyCRVContract.getVotesUnpacked()
		]) as [number, TUserInfo, TGetVotesUnpacked];

		return {nextPeriod, userInfo, getVotesUnpacked};
	}, [address, isActive, provider]);

	const {data, mutate} = useSWR<TUseVLyCRV['initialData']>(isActive && provider ? 'vLyCRV' : null, fetcher);

	return {
		initialData: data ?? DEFAULT_VLYCRV,
		mutateData: mutate,
		deposit: vLyCRVDeposit,
		withdraw: vLyCRVWithdraw,
		vote: vLyCRVVote,
		voteMany: vLyCRVVoteMany,
		approve: async (provider: TWeb3Provider, amount: bigint): Promise<TTxResponse> => 
			approveERC20(provider, YCRV_TOKEN_ADDRESS, VLYCRV_TOKEN_ADDRESS, amount)
		
	};
}
