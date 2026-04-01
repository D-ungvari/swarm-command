# Log: Mobile Touch Support
Started: 2026-04-02T00:00:00Z

## PLAN
Steps:
1. DeviceDetect.ts utility module
2. InputManager touch event layer (touchstart/touchmove/touchend → pendingMouseEvents; two-finger tap → rightdown; 2-finger gesture suppression)
3. Viewport drag({ touch: false }) when isTouchDevice; edge scroll suppression on touch drag
4. Portrait orientation overlay in index.html; start screen touch sizing
5. InputProcessor: expose setAttackMovePending/setPatrolPending setters
6. SelectionSystem: optional extra touch tolerance parameter
7. Create TouchCommandBar.ts (on-screen ability/command buttons for touch)
8. Wire everything into Game.ts

## DEV
