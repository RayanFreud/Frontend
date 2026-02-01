// Toast Store - Notification system
import { defineStore } from 'pinia'

export interface Toast {
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title?: string
    message: string
    duration: number
    dismissible: boolean
}

export const useToastStore = defineStore('toast', () => {
    const toasts = ref<Toast[]>([])

    const DEFAULT_DURATION = 5000

    /**
     * Generate unique toast ID
     */
    function generateId(): string {
        return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * Add a toast notification
     */
    function addToast(options: Partial<Toast> & { message: string }): string {
        const id = generateId()
        const toast: Toast = {
            id,
            type: options.type || 'info',
            title: options.title,
            message: options.message,
            duration: options.duration ?? DEFAULT_DURATION,
            dismissible: options.dismissible ?? true
        }

        toasts.value.push(toast)

        // Auto-dismiss after duration
        if (toast.duration > 0) {
            setTimeout(() => {
                dismiss(id)
            }, toast.duration)
        }

        return id
    }

    /**
     * Show success toast
     */
    function success(message: string, options?: Partial<Toast>): string {
        return addToast({ ...options, type: 'success', message })
    }

    /**
     * Show error toast
     */
    function error(message: string, options?: Partial<Toast>): string {
        return addToast({
            ...options,
            type: 'error',
            message,
            duration: options?.duration ?? 8000 // Errors stay longer
        })
    }

    /**
     * Show warning toast
     */
    function warning(message: string, options?: Partial<Toast>): string {
        return addToast({ ...options, type: 'warning', message })
    }

    /**
     * Show info toast
     */
    function info(message: string, options?: Partial<Toast>): string {
        return addToast({ ...options, type: 'info', message })
    }

    /**
     * Dismiss a specific toast
     */
    function dismiss(id: string): void {
        const index = toasts.value.findIndex(t => t.id === id)
        if (index !== -1) {
            toasts.value.splice(index, 1)
        }
    }

    /**
     * Dismiss all toasts
     */
    function dismissAll(): void {
        toasts.value = []
    }

    return {
        toasts: readonly(toasts),
        addToast,
        success,
        error,
        warning,
        info,
        dismiss,
        dismissAll
    }
})
