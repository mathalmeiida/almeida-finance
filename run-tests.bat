@echo off
set TEST_PASSWORD=Teste123!@#
npx playwright test tests/e2e/onboarding-completo.spec.js --reporter=list
