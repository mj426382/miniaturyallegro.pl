import { lazyModal } from '../utils/lazyPage'

/**
 * Spec 17, AC-PERF-006: every dialog is its own chunk, never imported statically by a screen. Screens render them
 * inside <Suspense fallback={<ModalFallback />}> and call `preload` on the first interaction
 * (usePreloadOnInteraction), so a dialog opens instantly – also offline – once the user starts using the screen.
 */
export const ExportModal = lazyModal(() => import('./ExportModal'))
export const InfographicModal = lazyModal(() => import('./InfographicModal'))
export const PaywallModal = lazyModal(() => import('./PaywallModal'))
export const BulkDescriptionsModal = lazyModal(() => import('./BulkDescriptionsModal'))
export const AdminUserModal = lazyModal(() => import('./AdminUserModal'))
