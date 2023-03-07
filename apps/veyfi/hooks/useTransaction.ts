import {useState} from 'react';
import {yToast} from '@yearn-finance/web-lib/components/yToast';

import type {TWeb3Provider} from '@yearn-finance/web-lib/contexts/types';
import type {Maybe} from '@yearn-finance/web-lib/types';
import type {TTxResponse} from '@yearn-finance/web-lib/utils/web3/transaction';

type TStatus = {
	loading?: boolean;
	error?: string;
	executed?: boolean;
}

type TTxFuncArgs = Parameters<(arg1: TWeb3Provider, ...args: unknown[] ) => void>

type TTxFunc<T1 extends TTxFuncArgs, T2> = (...args: T1) => Promise<T2>;

export const useTransaction = <T extends TTxFuncArgs>(
	func: TTxFunc<T, TTxResponse>,
	onSuccess?: (payload: TTxResponse) => void,
	onError?: (error: unknown) => void
): [TTxFunc<T, TTxResponse>, TStatus, Maybe<TTxResponse>] => {
	const {toast} = yToast();
	const [result, set_result] = useState<TTxResponse>();
	const [isLoading, set_isLoading] = useState(false);
	const [error, set_error] = useState<Maybe<string>>(undefined);
	const [isExecuted, set_isExecuted] = useState<boolean>(false);

	const status: TStatus = {
		loading: isLoading,
		error,
		executed: isExecuted
	};

	const execute = async (...p: T): Promise<TTxResponse> => {
		set_isLoading(true);
		set_error(undefined);
		try {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			const funcResult = await func(...p);
			if(!funcResult) {
				throw new Error('Transaction failed');
			}
			set_result(funcResult);
			set_isLoading(false);
			set_isExecuted(true);
			toast({content: 'Transaction successful', type: 'success'});
			if (onSuccess) {
				onSuccess(funcResult);
			}
			return funcResult;
		} catch (error: unknown) {
			if (error instanceof Error){
				console.error(error.message);
				set_error(error.message);
			} else {
				console.error(error);
				set_error('Unknown error');
			}
			set_result(undefined);
			set_isLoading(false);
			set_isExecuted(false);
			if (onError) {
				onError(error);
			}
			toast({content: 'Transaction failed', type: 'error'});
			return {isSuccessful: false};
		}
	};

	return [execute, status, result];
};
