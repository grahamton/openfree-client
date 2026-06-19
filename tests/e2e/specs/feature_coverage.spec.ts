import { test, expect } from "../fixtures";

test.describe("Tier 1: Feature Coverage Settings", () => {

  test("1. Transcription Backend - Default is Local", async ({ settingsPage }) => {
    const backendSelect = settingsPage.locator("select").first();
    await expect(backendSelect).toHaveValue("local");
  });

  test("2. Transcription Backend - Switch to Remote", async ({ settingsPage }) => {
    const backendSelect = settingsPage.locator("select").first();
    await backendSelect.selectOption("remote");
    await expect(backendSelect).toHaveValue("remote");
  });

  test("3. Transcription Backend - Save Remote Backend", async ({ settingsPage }) => {
    const backendSelect = settingsPage.locator("select").first();
    await backendSelect.selectOption("remote");
    
    // Save settings
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    await expect(saveButton).toHaveText("Saved!");

    // Verify config is saved in mock state
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.transcription_mode).toBe("remote");
  });

  test("4. Transcription Backend - Remote Server URL Input", async ({ settingsPage }) => {
    const backendSelect = settingsPage.locator("select").first();
    await backendSelect.selectOption("remote");
    
    // Verify server URL input is visible
    const serverUrlInput = settingsPage.locator("input[placeholder*='transcribe']");
    await expect(serverUrlInput).toBeVisible();
  });

  test("5. Transcription Backend - Save Remote Server URL", async ({ settingsPage }) => {
    const backendSelect = settingsPage.locator("select").first();
    await backendSelect.selectOption("remote");
    
    const serverUrlInput = settingsPage.locator("input[placeholder*='transcribe']");
    await serverUrlInput.fill("http://192.168.1.50:8766/transcribe");
    
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    await expect(saveButton).toHaveText("Saved!");

    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.server_url).toBe("http://192.168.1.50:8766/transcribe");
  });

  test("6. Hardware Acceleration - Option CPU", async ({ settingsPage }) => {
    // Hardware acceleration dropdown is the second select when in local mode (since availableModels select is also shown)
    // Actually, let's select hardware acceleration. In Settings.tsx:
    // It's labeled "Hardware Acceleration". Let's locate it by selecting the element after the label or matching options.
    const hwSelect = settingsPage.locator("select:has-text('CPU')");
    await hwSelect.selectOption("cpu");
    
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.local_backend).toBe("cpu");
  });

  test("7. Hardware Acceleration - Option CUDA", async ({ settingsPage }) => {
    const hwSelect = settingsPage.locator("select:has-text('CPU')");
    await hwSelect.selectOption("cuda");
    
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.local_backend).toBe("cuda");
  });

  test("8. Hardware Acceleration - Option Vulkan", async ({ settingsPage }) => {
    const hwSelect = settingsPage.locator("select:has-text('CPU')");
    await hwSelect.selectOption("vulkan");
    
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.local_backend).toBe("vulkan");
  });

  test("9. Hardware Acceleration - Visibility", async ({ settingsPage }) => {
    const backendSelect = settingsPage.locator("select").first();
    // In local mode, hardware acceleration is visible
    await backendSelect.selectOption("local");
    await expect(settingsPage.locator("select:has-text('CPU')")).toBeVisible();

    // Switch to remote mode, it should be hidden
    await backendSelect.selectOption("remote");
    await expect(settingsPage.locator("select:has-text('CPU')")).not.toBeVisible();
  });

  test("10. Autostart - Default is false", async ({ settingsPage }) => {
    const autostartCheckbox = settingsPage.locator("input[type='checkbox']").first();
    await expect(autostartCheckbox).not.toBeChecked();
  });

  test("11. Autostart - Enable and Save", async ({ settingsPage }) => {
    const autostartCheckbox = settingsPage.locator("input[type='checkbox']").first();
    await autostartCheckbox.check();
    
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.autostart).toBe(true);
  });

  test("12. Autostart - Disable and Save", async ({ settingsPage }) => {
    // Pre-set true in mock state and trigger focus to reload configuration
    await settingsPage.evaluate(() => {
      (window as any).__MOCK_CONFIG__.autostart = true;
      (window as any).simulateTauriEvent("tauri://focus", true);
    });
    
    const autostartCheckbox = settingsPage.locator("input[type='checkbox']").first();
    await expect(autostartCheckbox).toBeChecked();
    
    await autostartCheckbox.uncheck();
    
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.autostart).toBe(false);
  });

  test("13. Transcription Prompt - Initial Prompt Empty", async ({ settingsPage }) => {
    const promptTextarea = settingsPage.locator("textarea");
    await expect(promptTextarea).toHaveValue("");
  });

  test("14. Transcription Prompt - Fill and Save", async ({ settingsPage }) => {
    const promptTextarea = settingsPage.locator("textarea");
    const testPrompt = "Hello World, OpenFree vocabulary testing.";
    await promptTextarea.fill(testPrompt);
    
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.initial_prompt).toBe(testPrompt);
  });

  test("15. AI Cleanup - Default is Disabled", async ({ settingsPage }) => {
    // AI cleanup checkbox is the second checkbox
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await expect(aiCleanupCheckbox).not.toBeChecked();
  });

  test("16. AI Cleanup - Enable and Show Fields", async ({ settingsPage }) => {
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    // Verify AI settings selects/inputs are now visible
    const backendSelect = settingsPage.locator("select:has-text('LM Studio')");
    const modeSelect = settingsPage.locator("select:has-text('Cleanup')");
    const modelInput = settingsPage.locator("input[placeholder='llama3.2']");

    await expect(backendSelect).toBeVisible();
    await expect(modeSelect).toBeVisible();
    await expect(modelInput).toBeVisible();
  });

  test("17. AI Cleanup - Disable and Hide Fields", async ({ settingsPage }) => {
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    
    // Enable then disable
    await aiCleanupCheckbox.check();
    await aiCleanupCheckbox.uncheck();

    const backendSelect = settingsPage.locator("select:has-text('LM Studio')");
    await expect(backendSelect).not.toBeVisible();
  });

  test("18. AI Cleanup - Select Backend Ollama", async ({ settingsPage }) => {
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    const backendSelect = settingsPage.locator("select:has-text('LM Studio')");
    await backendSelect.selectOption("ollama");

    const ollamaUrlInput = settingsPage.locator("input[placeholder='http://localhost:11434']");
    await expect(ollamaUrlInput).toBeVisible();
  });

  test("19. AI Cleanup - Select Backend OpenAI", async ({ settingsPage }) => {
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    const backendSelect = settingsPage.locator("select:has-text('LM Studio')");
    await backendSelect.selectOption("openai");

    const openaiKeyInput = settingsPage.locator("input[placeholder='sk-...']");
    await expect(openaiKeyInput).toBeVisible();
  });

  test("20. AI Cleanup - Save All Options", async ({ settingsPage }) => {
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    const backendSelect = settingsPage.locator("select:has-text('LM Studio')");
    await backendSelect.selectOption("openai");

    const modeSelect = settingsPage.locator("select:has-text('Cleanup')");
    await modeSelect.selectOption("smart");

    const modelInput = settingsPage.locator("input[placeholder='gpt-4o-mini']");
    await modelInput.fill("custom-gpt-model");

    const openaiKeyInput = settingsPage.locator("input[placeholder='sk-...']");
    await openaiKeyInput.fill("my-secret-key-123");

    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    await expect(saveButton).toHaveText("Saved!");

    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.ai_cleanup_enabled).toBe(true);
    expect(savedConfig.ai_backend).toBe("openai");
    expect(savedConfig.ai_mode).toBe("smart");
    expect(savedConfig.ai_model).toBe("custom-gpt-model");
    expect(savedConfig.openai_api_key).toBe("my-secret-key-123");
  });
});
