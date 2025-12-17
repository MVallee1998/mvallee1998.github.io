/*
	Editorial by HTML5 UP
	html5up.net | @ajlkn
	Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/

(function($) {

	skel.breakpoints({
		xlarge: '(max-width: 1680px)',
		large: '(max-width: 1280px)',
		medium: '(max-width: 980px)',
		small: '(max-width: 736px)',
		xsmall: '(max-width: 480px)',
		'xlarge-to-max': '(min-width: 1681px)',
		'small-to-xlarge': '(min-width: 481px) and (max-width: 1680px)'
	});

	$(function() {

		var	$window = $(window),
			$head = $('head'),
			$body = $('body');

		// Disable animations/transitions ...

			// ... until the page has loaded.
				$body.addClass('is-loading');

				$window.on('load', function() {
					setTimeout(function() {
						$body.removeClass('is-loading');
					}, 100);
				});

			// ... when resizing.
				var resizeTimeout;

				$window.on('resize', function() {

					// Mark as resizing.
						$body.addClass('is-resizing');

					// Unmark after delay.
						clearTimeout(resizeTimeout);

						resizeTimeout = setTimeout(function() {
							$body.removeClass('is-resizing');
						}, 100);

				});

		// Fix: Placeholder polyfill.
			$('form').placeholder();

		// Prioritize "important" elements on medium.
			skel.on('+medium -medium', function() {
				$.prioritize(
					'.important\\28 medium\\29',
					skel.breakpoint('medium').active
				);
			});

		// Fixes.

			// Object fit images.
				if (!skel.canUse('object-fit')
				||	skel.vars.browser == 'safari')
					$('.image.object').each(function() {

						var $this = $(this),
							$img = $this.children('img');

						// Hide original image.
							$img.css('opacity', '0');

						// Set background.
							$this
								.css('background-image', 'url("' + $img.attr('src') + '")')
								.css('background-size', $img.css('object-fit') ? $img.css('object-fit') : 'cover')
								.css('background-position', $img.css('object-position') ? $img.css('object-position') : 'center');

					});

		// Sidebar.
			var $sidebar = $('#sidebar'),
				$sidebar_inner = $sidebar.children('.inner');

			// Inactive by default on <= large.
				skel
					.on('+large', function() {
						$sidebar.addClass('inactive');
					})
					.on('-large !large', function() {
						$sidebar.removeClass('inactive');
					});

			// Hack: Workaround for Chrome/Android scrollbar position bug.
				if (skel.vars.os == 'android'
				&&	skel.vars.browser == 'chrome')
					$('<style>#sidebar .inner::-webkit-scrollbar { display: none; }</style>')
						.appendTo($head);

			// Toggle.
				if (skel.vars.IEVersion > 9) {

					$('<a href="#sidebar" class="toggle">Toggle</a>')
						.appendTo($sidebar)
						.on('click', function(event) {

							// Prevent default.
								event.preventDefault();
								event.stopPropagation();

							// Toggle.
								$sidebar.toggleClass('inactive');

						});

				}

			// Events.

				// Link clicks.
					$sidebar.on('click', 'a', function(event) {

						// >large? Bail.
							if (!skel.breakpoint('large').active)
								return;

						// Vars.
							var $a = $(this),
								href = $a.attr('href'),
								target = $a.attr('target');

						// Prevent default.
							event.preventDefault();
							event.stopPropagation();

						// Check URL.
							if (!href || href == '#' || href == '')
								return;

						// Hide sidebar.
							$sidebar.addClass('inactive');

						// Redirect to href.
							setTimeout(function() {

								if (target == '_blank')
									window.open(href);
								else
									window.location.href = href;

							}, 500);

					});

				// Prevent certain events inside the panel from bubbling.
					$sidebar.on('click touchend touchstart touchmove', function(event) {

						// >large? Bail.
							if (!skel.breakpoint('large').active)
								return;

						// Prevent propagation.
							event.stopPropagation();

					});

				// Hide panel on body click/tap.
					$body.on('click touchend', function(event) {

						// >large? Bail.
							if (!skel.breakpoint('large').active)
								return;

						// Deactivate.
							$sidebar.addClass('inactive');

					});

			// Scroll lock.
			// Note: If you do anything to change the height of the sidebar's content, be sure to
			// trigger 'resize.sidebar-lock' on $window so stuff doesn't get out of sync.

				$window.on('load.sidebar-lock', function() {

					var sh, wh, st;

					// Reset scroll position to 0 if it's 1.
						if ($window.scrollTop() == 1)
							$window.scrollTop(0);

					$window
						.on('scroll.sidebar-lock', function() {

							var x, y;

							// IE<10? Bail.
								if (skel.vars.IEVersion < 10)
									return;

							// <=large? Bail.
								if (skel.breakpoint('large').active) {

									$sidebar_inner
										.data('locked', 0)
										.css('position', '')
										.css('top', '');

									return;

								}

							// Calculate positions.
								x = Math.max(sh - wh, 0);
								y = Math.max(0, $window.scrollTop() - x);

							// Lock/unlock.
								if ($sidebar_inner.data('locked') == 1) {

									if (y <= 0)
										$sidebar_inner
											.data('locked', 0)
											.css('position', '')
											.css('top', '');
									else
										$sidebar_inner
											.css('top', -1 * x);

								}
								else {

									if (y > 0)
										$sidebar_inner
											.data('locked', 1)
											.css('position', 'fixed')
											.css('top', -1 * x);

								}

						})
						.on('resize.sidebar-lock', function() {

							// Calculate heights.
								wh = $window.height();
								sh = $sidebar_inner.outerHeight() + 30;

							// Trigger scroll.
								$window.trigger('scroll.sidebar-lock');

						})
						.trigger('resize.sidebar-lock');

					});

		// Menu.
			var $menu = $('#menu'),
				$menu_openers = $menu.children('ul').find('.opener');

			// Openers.
				$menu_openers.each(function() {

					var $this = $(this);

					$this.on('click', function(event) {

						// Prevent default.
							event.preventDefault();

						// Toggle.
							$menu_openers.not($this).removeClass('active');
							$this.toggleClass('active');

						// Trigger resize (sidebar lock).
							$window.triggerHandler('resize.sidebar-lock');

					});

				});

		// Fetch and render arXiv Atom feed (graceful fallback when blocked).
			(function() {
				var feedUrl = 'https://arxiv.org/a/vallee_m_1.atom2';
				var $container = $('#arxiv-feed');
				if (!$container.length) return;
				var maxItems = 2;

				// arXiv does not set CORS headers; use a lightweight public proxy as a quick fix.
				// Long-term: fetch server-side during build/deploy or host a simple proxy.
				var proxies = [
					'https://api.allorigins.win/raw?url=',
					'https://api.allorigins.win/get?url='
				];

				function tryFetchProxy(i) {
					if (i >= proxies.length) {
						console.error('arXiv feed: all proxies failed');
						$container.html('<p>Could not load arXiv feed. <a href="' + feedUrl + '" target="_blank" rel="noopener">Open feed</a></p>');
						return;
					}

					var url = proxies[i] + encodeURIComponent(feedUrl);
					var isJSONProxy = proxies[i].indexOf('/get?url=') !== -1;

					if (i > 0) { $container.html('<p>Trying alternative proxy…</p>'); }
					fetch(url).then(function(resp) {
						if (!resp.ok) throw new Error('Network response was not ok (proxy ' + i + ')');
						if (isJSONProxy) return resp.json().then(function(data){ return data && data.contents ? data.contents : Promise.reject(new Error('No contents from JSON proxy')); });
						return resp.text();
					}).then(function(text) {
						var parser = new DOMParser();
						var xml = parser.parseFromString(text, 'application/xml');
						var entries = xml.querySelectorAll('entry');
						if (!entries || entries.length === 0) {
							$container.html('<p>No recent arXiv entries found. <a href="' + feedUrl + '" target="_blank" rel="noopener">View feed</a></p>');
							return;
						}

						var html = '<dl class="arxiv-list">';
						for (var j = 0; j < Math.min(entries.length, maxItems); j++) {
							var e = entries[j];
							var title = e.querySelector('title') ? e.querySelector('title').textContent.trim() : '';
							var linkEl = e.querySelector('link[rel="alternate"]') || e.querySelector('link');
							var link = linkEl ? (linkEl.getAttribute('href') || linkEl.textContent) : (e.querySelector('id') ? e.querySelector('id').textContent : '#');
							var updated = e.querySelector('updated') ? e.querySelector('updated').textContent : (e.querySelector('published') ? e.querySelector('published').textContent : '');
							var summary = e.querySelector('summary') ? e.querySelector('summary').textContent.trim() : '';
							var summaryShort = summary.length > 300 ? summary.slice(0, 300).replace(/\s+\S*$/, '') + '…' : summary;
							// parse authors and show co-authors (exclude the site owner)
							var authorEl = e.querySelector('author name');
							var authors = [];
							if (authorEl && authorEl.textContent) {
								authors = authorEl.textContent.split(',').map(function(s){ return s.trim(); });
							}
							var coauthors = authors.filter(function(a){ return !/mathieu/i.test(a) && !/vall[eé]e/i.test(a); });

							html += '<dt><h4><a href="' + link + '" target="_blank" rel="noopener">' + title + '</a></h4></dt>';
							html += '<dd>';
							if (updated) {
							var d = new Date(updated);
							html += '<p><em>' + d.toLocaleString('en', { month: 'long', year: 'numeric' }) + '</em></p>';
						}
							if (coauthors && coauthors.length) {
								html += '<p><strong>Co-authors:</strong> ' + coauthors.join(', ') + '</p>';
							}
							html += '<p><strong>Abstract: </strong>' + summaryShort + ' <a href="' + link + '" target="_blank" rel="noopener">[read]</a></p>';
							html += '</dd>';
						}
						html += '</dl>';
						$container.html(html);
					}).catch(function(err) {
						console.warn('arXiv proxy ' + i + ' failed:', err);
						// try next proxy
						tryFetchProxy(i+1);
					});
				}

				// start trying proxies
				tryFetchProxy(0);

			})();

			// Fetch and render publications from local BibTeX
			(function() {
				var bibUrl = '/References/articles.bib';
				var $container = $('#publications-list');
				if (!$container.length) return;
				$container.html('<p>Loading publications…</p>');

				var bibUrls = [bibUrl, 'References/articles.bib'];
				function tryFetchBib(i) {
					if (i >= bibUrls.length) {
						$container.html('<p>Could not load publications from the BibTeX file. Ensure <code>References/articles.bib</code> exists and the site is served over HTTP (not file://). See console for details.</p>');
						console.error('Publications fetch: all attempts failed');
						return;
					}
					var url = bibUrls[i];
					if (i > 0) $container.html('<p>Trying alternative path: ' + url + ' …</p>');
					fetch(url).then(function(resp) {
						if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + resp.statusText + ' when fetching ' + url);
						return resp.text();
					}).then(function(text) {
						// strip simple comments
						text = text.replace(/^[ \t]*%.*$/gm, '');
						// ensure each entry starts with @
						text = text.replace(/^\s+/, '');
						var rawEntries = text.split(/\n\s*@(?=[a-zA-Z])/);
						var entries = [];
						rawEntries.forEach(function(raw, idx) {
							if (!raw) return;
							raw = (raw.charAt(0) === '@') ? raw : ('@' + raw);
							var m = raw.match(/^@(\w+)\s*{\s*([^,]+),/i);
							if (!m) return;
							var type = m[1];
							var key = m[2];
							var body = raw.slice(m[0].length);
							var fields = {};
							var fieldRegex = /(\w+)\s*=\s*(\{([\s\S]*?)\}|\"([\s\S]*?)\"|([^,}]+))\s*(,|$)/g;
							var fm;
							while ((fm = fieldRegex.exec(body)) !== null) {
								var fname = fm[1].toLowerCase();
								var fval = fm[3] || fm[4] || fm[5] || '';
								fval = fval.replace(/[\r\n]+/g, ' ').trim();
								fields[fname] = fval;
							}
							entries.push({type: type, key: key, fields: fields});
						});

						if (!entries.length) {
							$container.html('<p>No publications found in the BibTeX file.</p>');
							return;
						}

						// sort by year desc (fallback to sort by key)
						entries.sort(function(a,b){ var ya = parseInt(a.fields.year)||0; var yb = parseInt(b.fields.year)||0; if (ya===yb) return a.key.localeCompare(b.key); return yb - ya; });

						var html = '<dl class="pub-list">';
						entries.forEach(function(ent) {
							var f = ent.fields;
							var title = f.title || '(untitled)';
							// remove surrounding braces/quotes if present
							title = title.replace(/^\{(.*)\}$/,'$1').replace(/^\"(.*)\"$/,'$1');
							// escape helper
							function esc(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
						// normalize double-hyphens to en dash for display
						function normDash(s){ return (s||'').toString().replace(/-{2,}/g, '–'); }
						// normalize title and compute co-authors
						title = normDash(title);
						var titleSafe = esc(title);
						var authors = f.author || '';
						var authorList = authors ? authors.split(/\s+and\s+/i).map(function(a){ return a.trim(); }) : [];
						var ownerRegex = /mathieu/i;
						var ownerLast = /vall[eé]e/i;
						var coauthors = authorList.filter(function(a){ return !(ownerRegex.test(a) || ownerLast.test(a)); });
						var coauthorHtml = coauthors.map(function(a){ return esc(a); }).join(', ');
							var link = '#';
							if (f.doi) { var doi = f.doi.replace(/^doi:\s*/i, '').trim(); link = 'https://doi.org/' + doi; }
							else if (f.url) link = f.url;
							else if (f.eprint && (/arxiv/i.test(f.archiveprefix||'') || f.eprint.match(/^\d{4}\.\d{4,5}$/))) link = 'https://arxiv.org/abs/' + f.eprint;
						var journal = f.fjournal || f.journal || f.booktitle || f.publisher || '';
						// Build a locale date string similar to arXiv output (use month if available)
						var pubDateDisplay = '';
						if (f.year) {
							var y = parseInt(f.year, 10);
							if (!isNaN(y)) {
								if (f.month) {
									var months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
									var mstr = String(f.month).toLowerCase().replace(/[^a-z0-9]/g,'');
									var mindex = null;
									if (/^\d+$/.test(mstr)) mindex = Math.max(0, Math.min(11, parseInt(mstr,10)-1));
									else if (mstr.length >= 3) mindex = months[mstr.slice(0,3)];
									if (typeof mindex === 'number' && !isNaN(mindex)) {
										var dt = new Date(y, mindex, 1);
									pubDateDisplay = dt.toLocaleString('en', { month: 'long', year: 'numeric' });
									} else {
										pubDateDisplay = String(y);
									}
								} else {
									pubDateDisplay = String(y);
								}
							}
						}
						html += '<dt><h4><a href="' + link + '" target="_blank" rel="noopener">' + titleSafe + '</a></h4></dt>';
						html += '<dd>';
						if (pubDateDisplay) html += '<p><em>' + pubDateDisplay + '</em></p>';
					if (coauthorHtml && coauthorHtml.length) html += '<p><strong>Co-authors:</strong> ' + coauthorHtml + '</p>';
				if (journal) {
					var vol = f.volume || f.vol || '';
					var num = f.number || f.issue || '';
					var pages = f.pages || '';
					// normalize dashes in journal and pages
					pages = normDash(pages);
					var journalRaw = normDash(journal);
					var journalParts = esc(journalRaw);
						if (vol) journalParts += ', vol. ' + esc(vol);
						if (num) journalParts += ', no. ' + esc(num);
						if (pages) journalParts += ', pp. ' + esc(pages);
						html += '<p><em>' + journalParts + '</em></p>';
					}
							html += '</dd>';
						});
						html += '</dl>';
						$container.html(html);
					}).catch(function(err) {
						console.warn('Publications fetch failed for', url, err);
						// try next url
						tryFetchBib(i+1);
					});
				}

				tryFetchBib(0);

			})();

	});

})(jQuery);
