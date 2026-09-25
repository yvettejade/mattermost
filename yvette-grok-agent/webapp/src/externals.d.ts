declare module 'react-redux' {
    export function useSelector<TState, TSelected>(
        selector: (state: TState) => TSelected,
    ): TSelected;
}
