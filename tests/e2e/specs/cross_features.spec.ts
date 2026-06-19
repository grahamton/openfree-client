import { test, expect } from "../fixtures";

test.describe("Tier 3: Cross-Feature Combinations", () => {

  test("1. Local Backend + AI Cleanup OpenAI", async ({ settingsPage }) => {
    // 1. Configure Local Backend options
    const backendSelect = settingsPage.locator("select").first();
    await backendSelect.selectOption("local");

    const modelSelect = settingsPage.locator("select").nth(1);
    await modelSelect.selectOption("C:\\models\\ggml-base.bin");

    const hwSelect = settingsPage.locator("select:has-text('CPU')");
    await hwSelect.selectOption("vulkan");

    // 2. Enable AI Cleanup and configure OpenAI
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    const aiBackendSelect = settingsPage.locator("select:has-text('LM Studio')");
    await aiBackendSelect.selectOption("openai");

    const modelInput = settingsPage.locator("input[placeholder='gpt-4o-mini']");
    await modelInput.fill("gpt-4-turbo");

    const keyInput = settingsPage.locator("input[placeholder='sk-...']");
    await keyInput.fill("test-openai-key-abc");

    // 3. Save and Verify
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    await expect(saveButton).toHaveText("Saved!");

    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.transcription_mode).toBe("local");
    expect(savedConfig.whisper_model_path).toBe("C:\\models\\ggml-base.bin");
    expect(savedConfig.local_backend).toBe("vulkan");
    expect(savedConfig.ai_cleanup_enabled).toBe(true);
    expect(savedConfig.ai_backend).toBe("openai");
    expect(savedConfig.ai_model).toBe("gpt-4-turbo");
    expect(savedConfig.openai_api_key).toBe("test-openai-key-abc");
  });

  test("2. Remote Backend + AI Cleanup Ollama", async ({ settingsPage }) => {
    // 1. Configure Remote Backend option
    const backendSelect = settingsPage.locator("select").first();
    await backendSelect.selectOption("remote");

    const serverUrlInput = settingsPage.locator("input[placeholder*='transcribe']");
    await serverUrlInput.fill("http://192.168.1.100:8766/transcribe");

    // 2. Enable AI Cleanup and configure Ollama
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    const aiBackendSelect = settingsPage.locator("select:has-text('LM Studio')");
    await aiBackendSelect.selectOption("ollama");

    const modelInput = settingsPage.locator("input[placeholder='llama3.2']");
    await modelInput.fill("llama3-custom");

    const urlInput = settingsPage.locator("input[placeholder='http://localhost:11434']");
    await urlInput.fill("http://my-ollama-host:11434");

    // 3. Save and Verify
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    await expect(saveButton).toHaveText("Saved!");

    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.transcription_mode).toBe("remote");
    expect(savedConfig.server_url).toBe("http://192.168.1.100:8766/transcribe");
    expect(savedConfig.ai_cleanup_enabled).toBe(true);
    expect(savedConfig.ai_backend).toBe("ollama");
    expect(savedConfig.ai_model).toBe("llama3-custom");
    expect(savedConfig.ai_ollama_url).toBe("http://my-ollama-host:11434");
  });

  test("3. Remote Backend + AI Cleanup LM Studio", async ({ settingsPage }) => {
    // 1. Configure Remote Backend
    const backendSelect = settingsPage.locator("select").first();
    await backendSelect.selectOption("remote");

    const serverUrlInput = settingsPage.locator("input[placeholder*='transcribe']");
    await serverUrlInput.fill("http://remote-server-port:8766/transcribe");

    // 2. Enable AI Cleanup and configure LM Studio
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    const aiBackendSelect = settingsPage.locator("select:has-text('LM Studio')");
    await aiBackendSelect.selectOption("lmstudio");

    const modelInput = settingsPage.locator("input[placeholder='llama3.2']");
    await modelInput.fill("lmstudio-model-name");

    const urlInput = settingsPage.locator("input[placeholder='http://localhost:1234']");
    await urlInput.fill("http://lmstudio-server:1234");

    // 3. Save and Verify
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    await expect(saveButton).toHaveText("Saved!");

    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.transcription_mode).toBe("remote");
    expect(savedConfig.server_url).toBe("http://remote-server-port:8766/transcribe");
    expect(savedConfig.ai_cleanup_enabled).toBe(true);
    expect(savedConfig.ai_backend).toBe("lmstudio");
    expect(savedConfig.ai_model).toBe("lmstudio-model-name");
    expect(savedConfig.ai_lmstudio_url).toBe("http://lmstudio-server:1234");
  });

  test("4. Changing local hardware acceleration while AI Cleanup is active", async ({ settingsPage }) => {
    // 1. Enable AI Cleanup
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    // 2. Change hardware acceleration
    const hwSelect = settingsPage.locator("select:has-text('CPU')");
    await hwSelect.selectOption("cuda");

    // 3. Save and Verify
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    await expect(saveButton).toHaveText("Saved!");

    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.local_backend).toBe("cuda");
    expect(savedConfig.ai_cleanup_enabled).toBe(true);
  });

  test("5. Enabling autostart along with AI Cleanup and customized prompt", async ({ settingsPage }) => {
    // 1. Fill customized prompt
    const promptTextarea = settingsPage.locator("textarea");
    await promptTextarea.fill("My customized terminology: API, GPT.");

    // 2. Check Autostart
    const autostartCheckbox = settingsPage.locator("input[type='checkbox']").first();
    await autostartCheckbox.check();

    // 3. Enable AI Cleanup OpenAI
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    const aiBackendSelect = settingsPage.locator("select:has-text('LM Studio')");
    await aiBackendSelect.selectOption("openai");

    const keyInput = settingsPage.locator("input[placeholder='sk-...']");
    await keyInput.fill("openai-key-cross-test");

    // 4. Save and Verify
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    await expect(saveButton).toHaveText("Saved!");

    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.initial_prompt).toBe("My customized terminology: API, GPT.");
    expect(savedConfig.autostart).toBe(true);
    expect(savedConfig.ai_cleanup_enabled).toBe(true);
    expect(savedConfig.ai_backend).toBe("openai");
    expect(savedConfig.openai_api_key).toBe("openai-key-cross-test");
  });
});
