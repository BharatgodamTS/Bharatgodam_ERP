import { test, expect } from '@playwright/test';

test.describe('Warehouse Authentication Flow', () => {
  const uniqueEmail = `picker_${Date.now()}@warehouse-test.com`;
  const securePassword = 'testpassword123';

  // Make sure to handle all JS alerts globally so they don't block tests
  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
  });

  test('should successfully sign up, toggle modes, and redirect on login', async ({ page }) => {
    // Navigate and wait for the React hydration to finish
    await page.goto('/', { waitUntil: 'networkidle' });

    // 1. Toggle to "Sign Up" mode using resilient text match
    await page.getByText("Don't have an account? Sign Up").click();
    
    // Verify the UI changed and rendered the new header
    await expect(page.getByRole('heading', { name: 'Create new account' })).toBeVisible();

    // 2. Fill Out Form using ARIA Labels/Placeholders
    await page.getByPlaceholder('Email ID').fill(uniqueEmail);
    await page.getByPlaceholder('Create Password (Min 6 chars)').fill(securePassword);
    
    // Setup listener before action
    const signupResponsePromise = page.waitForResponse(response => 
      response.url().includes('/api/auth/signup') && response.request().method() === 'POST'
    );
    
    // Optional: Take a snapshot right before clicking for visual debugging
    await page.screenshot({ path: 'debug/before-signup-submit.png', fullPage: true });

    // Click the specific Submit button
    await page.getByRole('button', { name: 'Sign Up' }).click();
    
    // 3. Verify API response
    const signupResponse = await signupResponsePromise;
    expect(signupResponse.status()).toBe(201);
  });

  test('Edge Case: Prevent Duplicate Emails', async ({ page }) => {
    const duplicateEmail = 'static_duplicate@warehouse-test.com';
    
    // Setup Database Pre-condition via API
    await page.request.post('/api/auth/signup', {
      data: { email: duplicateEmail, password: 'password123' }
    });

    await page.goto('/');
    await page.getByText("Don't have an account? Sign Up").click();
    
    await page.getByPlaceholder('Email ID').fill(duplicateEmail);
    await page.getByPlaceholder('Create Password (Min 6 chars)').fill('password123');
    
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/auth/signup'));
    await page.getByRole('button', { name: 'Sign Up' }).click();
    
    const response = await responsePromise;
    expect(response.status()).toBe(400); // Bad Request
    
    const responseBody = await response.json();
    expect(responseBody.message).toContain('already exists');
  });

  test('Edge Case: Reject Incorrect Password', async ({ page }) => {
    // Assumption: static_duplicate user was created in the previous test block
    const validEmail = 'static_duplicate@warehouse-test.com'; 

    await page.goto('/');
    
    // Sign In UI is the default state
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();

    await page.getByPlaceholder('Email ID').fill(validEmail);
    await page.getByPlaceholder('Password', { exact: true }).fill('totallyWrongPassword!');
    
    const responsePromise = page.waitForResponse(res => res.url().includes('/api/auth/signin'));
    await page.getByRole('button', { name: 'Login' }).click();
    
    const response = await responsePromise;
    expect(response.status()).toBe(401); // Unauthorized
    
    // Optional: Take a snapshot of the error state
    await page.screenshot({ path: 'debug/wrong-password-error.png' });
  });
});
