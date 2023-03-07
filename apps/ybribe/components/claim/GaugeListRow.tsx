/* eslint-disable react-hooks/exhaustive-deps */
import React, {useMemo, useState} from 'react';
import {Button} from '@yearn-finance/web-lib/components/Button';
import Renderable from '@yearn-finance/web-lib/components/Renderable';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {CRV_TOKEN_ADDRESS, CURVE_BRIBE_V3_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {formatToNormalizedValue, toBigInt, toNumber} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount, formatPercent, formatUSD} from '@yearn-finance/web-lib/utils/format.number';
import {isGreaterThanZero} from '@yearn-finance/web-lib/utils/isZero';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';
import {ImageWithFallback} from '@common/components/ImageWithFallback';
import {useYearn} from '@common/contexts/useYearn';
import {useBribes} from '@yBribe/contexts/useBribes';
import {claimReward} from '@yBribe/utils/actions/claimReward';

import type {ReactElement} from 'react';
import type {Maybe, TDict} from '@yearn-finance/web-lib/types';
import type {TCurveGauges} from '@common/types/curves';

function	GaugeRowItemWithExtraData({
	address,
	value,
	minDecimals = 5
}: {address: string, value: bigint, minDecimals?: number}): ReactElement {
	const	{tokens, prices} = useYearn();

	const	tokenInfo = tokens?.[address];
	const	symbol = tokenInfo?.symbol || '???';
	const	decimals = toNumber(tokenInfo?.decimals, 18);
	const	tokenPrice = toNumber(prices?.[address]) / 1000000;
	const	bribeAmount = formatToNormalizedValue(value, decimals);
	const	bribeValue = bribeAmount * toNumber(tokenPrice);

	return (
		<div className={'flex h-auto flex-col items-end pt-0 md:h-14'}>
			<div className={'yearn--table-data-section-item-value'}>
				{formatUSD(bribeValue, minDecimals, minDecimals)}
			</div>
			<p className={'font-number inline-flex items-baseline text-right text-xs text-neutral-400'}>
				{formatAmount(bribeAmount, minDecimals, minDecimals)}
				&nbsp;
				<span>{`${symbol}`}</span>
			</p>
		</div>
	);
}

function	GaugeRowItemAPR({address, value}: {address: string, value: bigint}): ReactElement {
	const	{tokens, prices} = useYearn();

	const	crvPrice = useMemo((): number => {
		const	tokenPrice = toNumber(prices?.[CRV_TOKEN_ADDRESS]);
		return tokenPrice;
	}, [prices]);

	const	tokenPrice = useMemo((): number => {
		const	tokenPrice = toNumber(prices?.[address]);
		return tokenPrice;
	}, [address, prices]);

	const	APR = useMemo((): number => {
		const	tokenInfo = tokens?.[address];
		const	decimals = toNumber(tokenInfo?.decimals, 18);
		if (tokenPrice === 0 || crvPrice === 0) {
			return 0;
		}
		return formatToNormalizedValue(value, decimals) * tokenPrice / crvPrice * 52 * 100;
	}, [address, crvPrice, tokenPrice, tokens, value]);

	return (
		<div className={'flex h-auto flex-col items-end pt-0 md:h-14'}>
			<b className={'yearn--table-data-section-item-value'}>
				{formatPercent(APR)}
			</b>
		</div>
	);
}


function	GaugeListRow({currentGauge, category}: {currentGauge: TCurveGauges, category: string}): ReactElement {
	const	{isActive, provider} = useWeb3();
	const	{currentRewards, nextRewards, claimable, refresh} = useBribes();
	const	[txStatusClaim, set_txStatusClaim] = useState(defaultTxStatus);

	const	currentRewardsForCurrentGauge = useMemo((): TDict<bigint> => {
		return currentRewards?.v3?.[toAddress(currentGauge.gauge)] || {};
	}, [currentGauge.gauge, currentRewards, category]);

	const	nextRewardsForCurrentGauge = useMemo((): TDict<bigint> => {
		return nextRewards?.v3?.[toAddress(currentGauge.gauge)] || {};
	}, [currentGauge.gauge, nextRewards, category]);

	const	claimableForCurrentGauge = useMemo((): TDict<bigint> => {
		return claimable?.v3?.[toAddress(currentGauge.gauge)] || {};
	}, [currentGauge.gauge, claimable, category]);

	const	claimableForCurrentGaugeMap = Object.entries(claimableForCurrentGauge || {}) || [];
	const	currentRewardsForCurrentGaugeMap = Object.entries(currentRewardsForCurrentGauge || {}) || [];
	const	nextRewardsForCurrentGaugeMap = Object.entries(nextRewardsForCurrentGauge || {}) || [];
	const	hasSomethingToClaim = claimableForCurrentGaugeMap.some(([, value]: [string, Maybe<bigint>]): boolean => isGreaterThanZero(value));

	function	onClaimReward(token: string): void {
		new Transaction(provider, claimReward, set_txStatusClaim).populate(
			CURVE_BRIBE_V3_ADDRESS,
			currentGauge.gauge,
			token
		).onSuccess(async (): Promise<void> => {
			await refresh();
		}).perform();
	}

	function	renderDefaultValueUSDFallback(): ReactElement {
		return (
			<div className={'flex h-auto flex-col items-end pt-0 md:h-14'}>
				<p className={'yearn--table-data-section-item-value'}>
					{formatUSD(0, 5, 5)}
				</p>
				<p className={'font-number inline-flex items-baseline text-right text-xs text-neutral-400'}>
					{'-'}
				</p>
			</div>
		);
	}
	function	renderDefaultValuesUSDFallback(): ReactElement {
		return (
			<div className={'flex h-auto flex-col items-end pt-0 md:h-14'}>
				<p className={'font-number inline-flex items-baseline text-base text-neutral-900'}>
					{formatUSD(0, 5, 5)}
				</p>
				<p className={'font-number inline-flex items-baseline text-right text-xs text-neutral-400'}>
					{'-'}
				</p>
			</div>
		);
	}
	function	renderDefaultValuePercentFallback(): ReactElement {
		return (
			<div className={'flex h-auto flex-col items-end pt-0 md:h-14'}>
				<p className={'yearn--table-data-section-item-value'}>
					{formatPercent(0)}
				</p>
			</div>
		);
	}
	function	renderMultipleButtonsFallback(): ReactElement[] {
		return (
			currentRewardsForCurrentGaugeMap.map(([key]: [string, Maybe<bigint>]): ReactElement =>
				<div key={`claim-${key}`} className={'h-14 pt-0'}>
					<Button
						className={'yearn--button-smaller w-full'}
						onClick={(): void => onClaimReward(key)}
						isBusy={txStatusClaim.pending}
						isDisabled={!isActive || !hasSomethingToClaim}>
						{'Claim'}
					</Button>
				</div>
			)
		);
	}

	return (
		<div className={'yearn--table-wrapper border-neutral-200 md:!border-t md:!border-solid'}>
			<div className={'yearn--table-token-section'}>
				<div className={'yearn--table-token-section-item'}>
					<div className={'yearn--table-token-section-item-image'}>
						<ImageWithFallback
							alt={''}
							width={40}
							height={40}
							quality={90}
							loading={'eager'}
							src={`${process.env.BASE_YEARN_ASSETS_URI}1/${toAddress(currentGauge.swap_token)}/logo-128.png`} />
					</div>
					<p>{currentGauge.name}</p>
				</div>
			</div>

			<div className={'yearn--table-data-section grid-cols-1 md:grid-cols-5'}>
				<div className={'yearn--table-data-section-item hidden h-auto md:block'}>
					<div>
						<div className={'flex h-auto flex-col items-end pt-0 md:h-14'}>
							<p className={'items-baseline text-end text-sm tabular-nums text-neutral-400'}>
								{'Current Period'}
							</p>
						</div>
						<div className={'flex h-auto flex-col items-end pt-0 md:h-14'}>
							<p className={'items-baseline text-end text-sm tabular-nums text-neutral-400'}>
								{'Pending Period'}
							</p>
						</div>
					</div>
				</div>


				<div className={'yearn--table-data-section-item h-auto'} datatype={'number'}>
					<div className={'w-full'}>
						<div className={'mb-4 flex h-auto flex-row items-baseline justify-between pt-0 md:mb-0 md:h-14 md:flex-col md:items-end'}>
							<label className={'yearn--table-data-section-item-label'}>{'Current $/veCRV'}</label>
							<Renderable
								shouldRender={!!currentRewardsForCurrentGaugeMap && currentRewardsForCurrentGaugeMap.length > 0}
								fallback={renderDefaultValueUSDFallback()}>
								{currentRewardsForCurrentGaugeMap.map(([key, value]: [string, Maybe<bigint>]): ReactElement =>
									<GaugeRowItemWithExtraData
										key={`current-rewards-${currentGauge.gauge}-${key}`}
										address={toAddress(key)}
										value={toBigInt(value)} />
								)}
							</Renderable>
						</div>
						<div className={'flex h-auto flex-row items-baseline justify-between pt-0 md:h-14 md:flex-col md:items-end'}>
							<label className={'yearn--table-data-section-item-label'}>{'Pending $/veCRV'}</label>
							<Renderable
								shouldRender={!!nextRewardsForCurrentGaugeMap && nextRewardsForCurrentGaugeMap.length > 0}
								fallback={renderDefaultValueUSDFallback()}>
								{nextRewardsForCurrentGaugeMap.map(([key, value]: [string, Maybe<bigint>]): ReactElement =>
									<GaugeRowItemWithExtraData
										key={`pending-rewards-${currentGauge.gauge}-${key}`}
										address={toAddress(key)}
										value={toBigInt(value)} />
								)}
							</Renderable>
						</div>
					</div>
				</div>


				<div className={'yearn--table-data-section-item h-auto'} datatype={'number'}>
					<div className={'w-full'}>
						<div className={'mb-4 flex h-auto flex-row items-baseline justify-between pt-0 md:mb-0 md:h-14 md:flex-col md:items-end'}>
							<label className={'yearn--table-data-section-item-label'}>{'Current APR'}</label>
							<Renderable
								shouldRender={!!currentRewardsForCurrentGaugeMap && currentRewardsForCurrentGaugeMap.length > 0}
								fallback={renderDefaultValuePercentFallback()}>
								{currentRewardsForCurrentGaugeMap.map(([key, value]: [string, Maybe<bigint>]): ReactElement =>
									<GaugeRowItemAPR
										key={`apr-${currentGauge.gauge}-${key}`}
										address={toAddress(key)}
										value={toBigInt(value)} />
								)}
							</Renderable>
						</div>
						<div className={'flex h-auto flex-row items-baseline justify-between pt-0 md:h-14 md:flex-col md:items-end'}>
							<label className={'yearn--table-data-section-item-label'}>{'Pending APR'}</label>
							<Renderable
								shouldRender={!!nextRewardsForCurrentGaugeMap && nextRewardsForCurrentGaugeMap.length > 0}
								fallback={renderDefaultValuePercentFallback()}>
								{nextRewardsForCurrentGaugeMap.map(([key, value]: [string, Maybe<bigint>]): ReactElement =>
									<GaugeRowItemAPR
										key={`apr-${currentGauge.gauge}-${key}`}
										address={toAddress(key)}
										value={toBigInt(value)} />
								)}
							</Renderable>
						</div>
					</div>
				</div>

				<div className={'yearn--table-data-section-item h-auto'} datatype={'number'}>
					<div className={'w-full'}>
						<div className={'flex h-auto flex-row items-baseline justify-between pt-0 md:h-14 md:flex-col md:items-end'}>
							<label className={'yearn--table-data-section-item-label'}>{'Claimable'}</label>
							<Renderable
								shouldRender={!!claimableForCurrentGaugeMap && claimableForCurrentGaugeMap.length > 0}
								fallback={renderDefaultValuesUSDFallback()}>
								{claimableForCurrentGaugeMap.map(([key, value]: [string, Maybe<bigint>]): ReactElement =>
									<div key={`claimable-${currentGauge.gauge}-${key}`} className={'flex flex-col items-end space-y-2'}>
										<GaugeRowItemWithExtraData
											address={toAddress(key)}
											value={toBigInt(value)} />
										<div className={'block h-auto pt-0 md:hidden md:h-16 md:pt-7'}>
											<Button
												className={'yearn--button-smaller w-full'}
												onClick={(): void => onClaimReward(key)}
												isBusy={txStatusClaim.pending}
												isDisabled={!isActive || !hasSomethingToClaim}>
												{'Claim'}
											</Button>
										</div>
									</div>
								)}
							</Renderable>
						</div>
					</div>
					<div />
				</div>


				<div className={'yearn--table-data-section-item md:col-span-1'} datatype={'number'}>
					<div className={'col-span-2 hidden flex-col items-end space-y-4 md:flex'}>
						<Renderable
							shouldRender={currentRewardsForCurrentGaugeMap?.length === 0}
							fallback={renderMultipleButtonsFallback()}>
							<div className={'h-14 pt-0'}>
								<Button
									className={'yearn--button-smaller w-full'}
									isBusy={txStatusClaim.pending}
									isDisabled>
									{'Claim'}
								</Button>
							</div>
						</Renderable>
					</div>
					<div />
				</div>
			</div>
		</div>
	);
}

export {GaugeListRow};
