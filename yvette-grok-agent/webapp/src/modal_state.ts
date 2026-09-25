type Listener = () => void;

let open = false;
const listeners = new Set<Listener>();

function emit() {
    listeners.forEach((listener) => listener());
}

export function openGrokModal() {
    open = true;
    emit();
}

export function closeGrokModal() {
    open = false;
    emit();
}

export function isGrokModalOpen() {
    return open;
}

export function subscribeGrokModal(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
