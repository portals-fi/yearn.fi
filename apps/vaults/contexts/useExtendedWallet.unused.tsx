import React, {createContext, memo, useCallback, useContext, useMemo} from 'react';
import {useWalletForExternalMigrations} from '@vaults/contexts/useWalletForExternalMigrations';
import {useWallet} from '@common/contexts/useWallet';

import type {ReactElement} from 'react';
import type {TBalanceData} from '@yearn-finance/web-lib/hooks/types';
import type {Maybe, TDict} from '@yearn-finance/web-lib/types';

export type	TExtendedWalletContext = {
	balances: TDict<Maybe<TBalanceData>>,
	balancesNonce: number,
	isLoading: boolean,
	refresh: () => Promise<TDict<Maybe<TBalanceData>>>
}

const	defaultProps = {
	balances: {},
	balancesNonce: 0,
	isLoading: true,
	refresh: async (): Promise<TDict<Maybe<TBalanceData>>> => ({})
};


/* 🔵 - Yearn Finance **********************************************************
** This context controls most of the user's wallet data we may need to
** interact with our app, aka mostly the balances and the token prices.
******************************************************************************/
const	ExtendedWalletContext = createContext<TExtendedWalletContext>(defaultProps);
export const ExtendedWalletContextApp = memo(function ExtendedWalletContextApp({children}: {children: ReactElement}): ReactElement {
	const	{balances, isLoading, refresh} = useWallet();
	const	{balances: defiBalances, isLoading: isLoadingDefiBalances, refresh: refreshDefiBalances, balancesNonce} = useWalletForExternalMigrations();

	const	onRefresh = useCallback(async (): Promise<TDict<Maybe<TBalanceData>>> => {
		const [updatedBalances, updatedDefiBalances] = await Promise.all([
			refresh(),
			refreshDefiBalances()
		]);
		return {...updatedBalances, ...updatedDefiBalances};
	}, [refresh, refreshDefiBalances]);

	const	mergedBalances = useMemo((): TDict<Maybe<TBalanceData>> => {
		if (!balances || !defiBalances) {
			return {};
		}
		return {
			...balances,
			...defiBalances
		};
	}, [balances, defiBalances]);

	/* 🔵 - Yearn Finance ******************************************************
	**	Setup and render the Context provider to use in the app.
	***************************************************************************/
	const	contextValue = useMemo((): TExtendedWalletContext => ({
		balances: mergedBalances,
		isLoading: isLoading && isLoadingDefiBalances,
		refresh: onRefresh,
		balancesNonce: balancesNonce
	}), [mergedBalances, isLoading, isLoadingDefiBalances, onRefresh, balancesNonce]);

	return (
		<ExtendedWalletContext.Provider value={contextValue}>
			{children}
		</ExtendedWalletContext.Provider>
	);
});


export const useExtendedWallet = (): TExtendedWalletContext => useContext(ExtendedWalletContext);
export default useExtendedWallet;
