import React from 'react';
import {expect,test} from 'vitest';
import {render,screen} from '@testing-library/react';
import {ReviewQualityNote} from '../src/components/ReviewQualityNote';
import {CardRating} from '../src/components/Rating';
import {isRescued,recommendationEligible,qualityFields} from '../src/lib/review-quality';
const game={title:'Example & Game',review_positive_pct:60,review_count:1000,clean_score:91,bomb_windows:[{start:'2025-01-01',end:'2025-01-02',up:10,down:100},{start:'2026-11-09',end:'2026-11-11',up:20,down:200}],checked_at:'2026-11-13T00:00:00Z'};
test('retains unrated games and rejects ordinary Mixed games or positive-dominant rescue data',()=>{
 expect(recommendationEligible({...game,review_count:9,clean_score:0})).toBe(true);
 expect(recommendationEligible({...game,clean_score:60})).toBe(false);
 expect(isRescued({...game,bomb_windows:[{start:'2026-01-01',end:'2026-01-02',up:300,down:100}]})).toBe(false);
 expect(isRescued(game)).toBe(true);
 expect(qualityFields(game)).toMatchObject({steam_score:60,clean_score:91,review_bombed:true});
});
test('discloses the latest window and earlier count with an encoded neutral learn-more link',()=>{
 render(<ReviewQualityNote game={game}/>);
 expect(screen.getByText(/From Nov 9, 2026 to Nov 11, 2026 \(and 1 earlier period\)/)).toBeTruthy();
 const link=screen.getByRole('link',{name:'Learn more ↗'});
 expect(link.getAttribute('target')).toBe('_blank');expect(link.getAttribute('rel')).toContain('noopener');
 expect(link.getAttribute('href')).toBe('https://www.google.com/search?q='+encodeURIComponent('Example & Game review bombing'));
});
test('preserves Steam label on rescued cards with spaced disclosure',()=>{
 render(<CardRating pct={60} count={1000} rescued/>);expect(screen.getByText('Review bombed')).toBeTruthy();expect(screen.getByText(/Mixed/)).toBeTruthy();expect(screen.getByText('60%')).toBeTruthy();
});
test('ordinary and unrated pages have no disclosure',()=>{
 const view=render(<ReviewQualityNote game={{...game,review_positive_pct:95}}/>);expect(view.container.textContent).toBe('');
 view.rerender(<ReviewQualityNote game={{...game,review_count:1}}/>);expect(view.container.textContent).toBe('');
});
