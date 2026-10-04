// Country flags are a moderation aid, not a public badge (2026-10-04, same
// rule as Adopt Me's Code/Helper/countryFlag.js).
//
// Where they come from: the device region (CountryCheck.getFlag), saved to
// users/{uid}/flage for every signed-in user by the effect in GlobelStats.js
// and refreshed whenever the device region changes. There is no user switch.
//
// Where they show: the profile bottom drawer
// (Code/ChatScreen/GroupChat/BottomDrawer.jsx) and the player's own Settings
// header, and only when the viewer is an admin. New messages and trades no
// longer carry a copy. Older ones still hold `flage`, but nothing renders it.
export const canSeeCountryFlags = (isAdmin) => !!isAdmin;
