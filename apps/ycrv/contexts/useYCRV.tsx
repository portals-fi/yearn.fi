import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import {Contract} from 'ethcall';
import useSWR from 'swr';
import {useSettings} from '@yearn-finance/web-lib/contexts/useSettings';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {allowanceKey} from '@yearn-finance/web-lib/utils/address';
import {CRV_TOKEN_ADDRESS, CVXCRV_TOKEN_ADDRESS, LPYCRV_TOKEN_ADDRESS, STYCRV_TOKEN_ADDRESS, VECRV_ADDRESS, VECRV_YEARN_TREASURY_ADDRESS, YCRV_CURVE_POOL_ADDRESS, YCRV_TOKEN_ADDRESS, YVBOOST_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS, YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {baseFetcher} from '@yearn-finance/web-lib/utils/fetchers';
import {formatUnits, toBigInt, toNumber, WeiPerEther, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';
import CURVE_CRV_YCRV_LP_ABI from '@yCRV/utils/abi/curveCrvYCrvLp.abi';
import STYCRV_ABI from '@yCRV/utils/abi/styCRV.abi';
import YVECRV_ABI from '@yCRV/utils/abi/yveCRV.abi';

import type {ReactElement} from 'react';
import type {SWRResponse} from 'swr';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TYDaemonHarvests, TYearnVault} from '@common/types/yearn';

type THoldings = {
	legacy: bigint;
	treasury: bigint;
	yCRVSupply: bigint;
	styCRVSupply: bigint;
	lpyCRVSupply: bigint;
	crvYCRVPeg: bigint;
	boostMultiplier: bigint;
	veCRVTotalSupply: bigint;
	veCRVBalance: bigint;
}
type TYCRVContext = {
	styCRVMegaBoost: number,
	styCRVAPY: number,
	slippage: number,
	allowances: TDict<bigint>,
	holdings: THoldings,
	harvests: TYDaemonHarvests[],
	set_slippage: (slippage: number) => void,
}

const	defaultProps = {
	styCRVMegaBoost: 0,
	styCRVAPY: 0,
	harvests: [],
	allowances: {},
	slippage: 0.6,
	set_slippage: (): void => undefined,
	holdings: {
		legacy: Zero,
		treasury: Zero,
		yCRVSupply: Zero,
		styCRVSupply: Zero,
		lpyCRVSupply: Zero,
		crvYCRVPeg: Zero,
		boostMultiplier: Zero,
		veCRVTotalSupply: Zero,
		veCRVBalance: Zero
	}
};

/* 🔵 - Yearn Finance **********************************************************
** This context controls the Holdings computation.
******************************************************************************/
const	YCRVContext = createContext<TYCRVContext>(defaultProps);
export const YCRVContextApp = ({children}: {children: ReactElement}): ReactElement => {
	const {provider, address, isActive} = useWeb3();
	const {settings: baseAPISettings} = useSettings();
	const [slippage, set_slippage] = useState<number>(0.6);

	// const	{data: styCRVExperimentalAPY} = useSWR(
	// 	`${baseAPISettings.yDaemonBaseURI}/1/vaults/apy/${STYCRV_TOKEN_ADDRESS}`,
	// 	baseFetcher,
	// 	{revalidateOnFocus: false}
	// ) as SWRResponse;

	const	{data: styCRVVault} = useSWR(
		`${baseAPISettings.yDaemonBaseURI || process.env.YDAEMON_BASE_URI}/1/vaults/${STYCRV_TOKEN_ADDRESS}`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;


	const	{data: yCRVHarvests} = useSWR(
		`${baseAPISettings.yDaemonBaseURI || process.env.YDAEMON_BASE_URI}/1/vaults/harvests/${STYCRV_TOKEN_ADDRESS},${LPYCRV_TOKEN_ADDRESS}`,
		baseFetcher,
		{revalidateOnFocus: false}
	) as SWRResponse;

	/* 🔵 - Yearn Finance ******************************************************
	** SWR hook to get the holdings data for the yCRV ecosystem.
	**************************************************************************/
	const numbersFetchers = useCallback(async (): Promise<TDict<bigint>> => {
		const	currentProvider = provider || getProvider(1);
		const	ethcallProvider = await newEthCallProvider(currentProvider);

		const	yCRVContract = new Contract(YCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	styCRVContract = new Contract(STYCRV_TOKEN_ADDRESS as string, STYCRV_ABI);
		const	lpyCRVContract = new Contract(LPYCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	yveCRVContract = new Contract(YVECRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	veEscrowContract = new Contract(VECRV_ADDRESS as string, YVECRV_ABI);
		const	crvYCRVLpContract = new Contract(YCRV_CURVE_POOL_ADDRESS as string, CURVE_CRV_YCRV_LP_ABI);

		const	[
			yveCRVTotalSupply,
			yveCRVInYCRV,
			veCRVBalance,
			veCRVTotalSupply,
			yCRVTotalSupply,
			styCRVTotalSupply,
			lpyCRVTotalSupply,
			crvYCRVPeg
		] = await ethcallProvider.tryAll([
			yveCRVContract.totalSupply(),
			yveCRVContract.balanceOf(YCRV_TOKEN_ADDRESS),
			veEscrowContract.balanceOf(VECRV_YEARN_TREASURY_ADDRESS),
			veEscrowContract.totalSupply(),
			yCRVContract.totalSupply(),
			styCRVContract.totalAssets(),
			lpyCRVContract.totalSupply(),
			crvYCRVLpContract.get_dy(1, 0, WeiPerEther)
		]) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

		return ({
			['legacy']: toBigInt(yveCRVTotalSupply - yveCRVInYCRV),
			['treasury']: toBigInt(veCRVBalance - yveCRVTotalSupply - yveCRVInYCRV - yCRVTotalSupply),
			['yCRVSupply']: toBigInt(yCRVTotalSupply),
			['styCRVSupply']: toBigInt(styCRVTotalSupply),
			['lpyCRVSupply']: toBigInt(lpyCRVTotalSupply),
			['crvYCRVPeg']: toBigInt(crvYCRVPeg),
			['boostMultiplier']: toBigInt(veCRVBalance * BigInt(1e4) / styCRVTotalSupply),
			['veCRVTotalSupply']: toBigInt(veCRVTotalSupply),
			['veCRVBalance']: toBigInt(veCRVBalance)
		});
	}, [provider]);
	const	{data: holdings} = useSWR('numbers', numbersFetchers, {shouldRetryOnError: false});


	/* 🔵 - Yearn Finance ******************************************************
	**	Once the wallet is connected and a provider is available, we can fetch
	**	the allowance informations for a specific wallet. As the possible path
	**	are limited, we can hardcode the contract addresses.
	***************************************************************************/
	const getAllowances = useCallback(async (): Promise<TDict<bigint>> => {
		if (!isActive || !provider) {
			return {};
		}
		const	currentProvider = provider || getProvider(1);
		const	ethcallProvider = await newEthCallProvider(currentProvider);
		const	userAddress = address;
		const	yCRVContract = new Contract(YCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	styCRVContract = new Contract(STYCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	lpyCRVContract = new Contract(LPYCRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	yveCRVContract = new Contract(YVECRV_TOKEN_ADDRESS as string, YVECRV_ABI);
		const	crvContract = new Contract(CRV_TOKEN_ADDRESS as string, ERC20_ABI);
		const	yvBoostContract = new Contract(YVBOOST_TOKEN_ADDRESS as string, ERC20_ABI);
		const	yCRVPoolContract = new Contract(YCRV_CURVE_POOL_ADDRESS as string, YVECRV_ABI);
		const	cvxCRVContract = new Contract(CVXCRV_TOKEN_ADDRESS as string, ERC20_ABI);

		const	[
			yCRVAllowanceZap, styCRVAllowanceZap, lpyCRVAllowanceZap,
			yveCRVAllowanceZap, crvAllowanceZap, yvBoostAllowanceZap,
			cvxCRVAllowanceZap,
			yveCRVAllowanceLP, crvAllowanceLP,
			yCRVPoolAllowanceVault
		] = await ethcallProvider.tryAll([
			yCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			styCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			lpyCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			yveCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			crvContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			yvBoostContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			cvxCRVContract.allowance(userAddress, ZAP_YEARN_VE_CRV_ADDRESS),
			yveCRVContract.allowance(userAddress, YVECRV_POOL_LP_ADDRESS),
			crvContract.allowance(userAddress, YVECRV_POOL_LP_ADDRESS),
			yCRVPoolContract.allowance(userAddress, LPYCRV_TOKEN_ADDRESS)
		]) as bigint[];

		return ({
			// YCRV ECOSYSTEM
			[allowanceKey(YCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: toBigInt(yCRVAllowanceZap),
			[allowanceKey(STYCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: toBigInt(styCRVAllowanceZap),
			[allowanceKey(LPYCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: toBigInt(lpyCRVAllowanceZap),
			[allowanceKey(CVXCRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: toBigInt(cvxCRVAllowanceZap),
			[allowanceKey(YCRV_CURVE_POOL_ADDRESS, LPYCRV_TOKEN_ADDRESS)]: toBigInt(yCRVPoolAllowanceVault),
			// CRV ECOSYSTEM
			[allowanceKey(YVECRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: toBigInt(yveCRVAllowanceZap),
			[allowanceKey(CRV_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]:  toBigInt(crvAllowanceZap),
			[allowanceKey(YVBOOST_TOKEN_ADDRESS, ZAP_YEARN_VE_CRV_ADDRESS)]: toBigInt(yvBoostAllowanceZap),
			[allowanceKey(YVECRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS)]: toBigInt(yveCRVAllowanceLP),
			[allowanceKey(CRV_TOKEN_ADDRESS, YVECRV_POOL_LP_ADDRESS)]:  toBigInt(crvAllowanceLP)
		});
	}, [provider, address, isActive]);
	const	{data: allowances} = useSWR(isActive && provider ? 'allowances' : null, getAllowances, {shouldRetryOnError: false});

	/* 🔵 - Yearn Finance ******************************************************
	** Compute the mega boost for the staked yCRV. This boost come from the
	** donator, with 30_000 per week.
	**************************************************************************/
	const	styCRVMegaBoost = useMemo((): number => {
		if (!holdings || holdings.styCRVSupply === Zero) {
			return 0;
		}
		const	fromDonatorPerWeek = 30_000;
		const	fromDonatorPerYear = fromDonatorPerWeek * 52;
		const	fromDonatorPerYearScaled = fromDonatorPerYear * 0.9;
		const	humanizedStyCRVSupply = toNumber(formatUnits(holdings.styCRVSupply, 18));
		const	megaBoostAPR = fromDonatorPerYearScaled / humanizedStyCRVSupply;
		return megaBoostAPR;
	}, [holdings]);

	/* 🔵 - Yearn Finance ******************************************************
	** Compute the styCRV APY based on the experimental APY and the mega boost.
	**************************************************************************/
	const	styCRVAPY = useMemo((): number => {
		return (toNumber((styCRVVault as TYearnVault)?.apy?.net_apy) * 100);
		// return (((styCRVVault as TYearnVault)?.apy?.net_apy || 0) * 100) + (styCRVMegaBoost * 100);
		// return (styCRVExperimentalAPY * 100) + (styCRVMegaBoost * 100);
	}, [styCRVVault]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TYCRVContext => ({
		harvests: yCRVHarvests,
		holdings: holdings as THoldings,
		allowances: allowances as TDict<bigint>,
		styCRVAPY,
		styCRVMegaBoost,
		slippage,
		set_slippage
	}), [yCRVHarvests, holdings, allowances, styCRVAPY, styCRVMegaBoost, slippage, set_slippage]);

	return (
		<YCRVContext.Provider value={contextValue}>
			{children}
		</YCRVContext.Provider>
	);
};


export const useYCRV = (): TYCRVContext => useContext(YCRVContext);
export default useYCRV;
