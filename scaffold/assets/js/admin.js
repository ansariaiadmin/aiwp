/**
 * {{PLUGIN_NAME}} admin behaviour — guided-help popovers.
 *
 * Vanilla JS (no jQuery dependency). Each (?) button toggles its popover;
 * only one popover is open at a time; Escape or an outside click closes it.
 * Popovers are positioned with fixed coordinates so they escape narrow
 * settings-table cells without page-level scrolling.
 */
( function () {
	'use strict';

	var PREFIX = '{{PREFIX}}';
	var openPop = null;
	var openBtn = null;

	function closeCurrent() {
		if ( ! openPop ) {
			return;
		}
		openPop.classList.remove( 'is-open' );
		openPop.setAttribute( 'hidden', '' );
		if ( openBtn ) {
			openBtn.setAttribute( 'aria-expanded', 'false' );
		}
		openPop = null;
		openBtn = null;
	}

	function position( btn, pop ) {
		// Make it measurable first (visibility:hidden keeps layout math valid).
		pop.style.position = 'fixed';
		pop.style.left = '0px';
		pop.style.top = '0px';

		var rect = btn.getBoundingClientRect();
		var popW = pop.offsetWidth || 360;
		var popH = pop.offsetHeight || 200;
		var left = Math.max( 12, Math.min( rect.left - 14, window.innerWidth - popW - 12 ) );
		var top = rect.bottom + 10;

		if ( top + popH > window.innerHeight - 12 ) {
			top = Math.max( 12, rect.top - popH - 10 );
		}

		pop.style.left = left + 'px';
		pop.style.top = top + 'px';
	}

	function toggle( btn ) {
		var id = btn.getAttribute( 'data-help-target' );
		var pop = id ? document.getElementById( id ) : null;

		if ( ! pop ) {
			return;
		}

		if ( openPop === pop ) {
			closeCurrent();
			return;
		}

		closeCurrent();
		pop.removeAttribute( 'hidden' );
		position( btn, pop );
		// Next frame → transition runs from hidden state to open state.
		window.requestAnimationFrame( function () {
			pop.classList.add( 'is-open' );
		} );
		btn.setAttribute( 'aria-expanded', 'true' );
		openPop = pop;
		openBtn = btn;
	}

	document.addEventListener( 'click', function ( ev ) {
		var trigger = ev.target.closest( '.' + PREFIX + '-help-trigger' );

		if ( trigger ) {
			ev.preventDefault();
			toggle( trigger );
			return;
		}

		if ( openPop && ! openPop.contains( ev.target ) ) {
			closeCurrent();
		}
	} );

	document.addEventListener( 'keydown', function ( ev ) {
		if ( 'Escape' === ev.key && openPop ) {
			var btn = openBtn;
			closeCurrent();
			if ( btn ) {
				btn.focus();
			}
		}
	} );

	window.addEventListener( 'resize', closeCurrent );
	window.addEventListener( 'scroll', function () {
		if ( openPop && openBtn ) {
			position( openBtn, openPop );
		}
	}, true );
} )();
