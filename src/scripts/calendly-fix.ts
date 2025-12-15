const OVERLAY_SELECTOR = '.calendly-overlay';
const POPUP_SELECTOR = '.calendly-popup, .calendly-popup-content';
const CLOSE_SELECTORS = ['.calendly-popup-close', '[aria-label="Close"]'];

const setIframeLower = (root: Element) => {
	const iframe = root.querySelector<HTMLIFrameElement>('iframe[src*="calendly"]');
	if (iframe) {
		iframe.style.zIndex = '0';
		iframe.style.position = 'relative';
	}
};

const elevateClose = (root: Element) => {
	let closeEl: HTMLElement | null = null;

	for (const selector of CLOSE_SELECTORS) {
		closeEl = root.querySelector<HTMLElement>(selector);
		if (closeEl) break;
	}

	if (!closeEl) {
		closeEl = Array.from(root.querySelectorAll<HTMLElement>('button, a')).find(
			(el) => el.textContent?.trim() === 'Close',
		) as HTMLElement | undefined ?? null;
	}

	if (closeEl) {
		closeEl.style.position = 'fixed';
		closeEl.style.top = '16px';
		closeEl.style.right = '16px';
		closeEl.style.zIndex = '2147483647';
		closeEl.style.pointerEvents = 'auto';
	}
};

const fixCalendlyLayering = () => {
	const overlays = document.querySelectorAll(OVERLAY_SELECTOR);
	overlays.forEach((overlay) => {
		if ((overlay as HTMLElement).dataset.calendlyFixed) return;
		const popup = overlay.querySelector(POPUP_SELECTOR) || overlay;
		setIframeLower(popup);
		elevateClose(popup);
		(overlay as HTMLElement).dataset.calendlyFixed = 'true';
	});
};

const observer = new MutationObserver(() => fixCalendlyLayering());

if (typeof window !== 'undefined') {
	document.addEventListener('DOMContentLoaded', () => {
		fixCalendlyLayering();
		observer.observe(document.body, { childList: true, subtree: true });
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			document.querySelectorAll(OVERLAY_SELECTOR).forEach((el) => el.remove());
			document.querySelectorAll(POPUP_SELECTOR).forEach((el) => el.remove());
		}
	});
}
