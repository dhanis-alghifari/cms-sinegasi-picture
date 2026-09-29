import assert from 'node:assert/strict';
import test from 'node:test';
import { getMobileNavigationItems, getVisibleNavigationItems } from '../src/app/navigation/navigationPolicy';

test('Humas navigation is visible for the Humas role on desktop and mobile', () => {
  const desktopItem = getVisibleNavigationItems('social_media_team')
    .find((item) => item.id === 'social-media');
  const mobileItem = getMobileNavigationItems('social_media_team')
    .find((item) => item.id === 'social-media');

  assert.equal(desktopItem?.to, '/social-media');
  assert.ok(mobileItem, 'Humas must be available in the primary mobile navigation');
});

test('navigation still honors explicit persisted capability sets', () => {
  const withoutHumasRead = getVisibleNavigationItems({ role: 'social_media_team', capabilities: ['dashboard.read.own'] });
  const withHumasRead = getVisibleNavigationItems({ role: 'social_media_team', capabilities: ['social_media.read'] });

  assert.equal(withoutHumasRead.some((item) => item.id === 'social-media'), false);
  assert.equal(withHumasRead.some((item) => item.id === 'social-media'), true);
});
