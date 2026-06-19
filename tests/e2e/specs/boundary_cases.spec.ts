import { test, expect } from "../fixtures";

test.describe("Tier 2: Boundary & Corner Cases", () => {

  test("1. Empty Prompt Saving", async ({ settingsPage }) => {
    const promptTextarea = settingsPage.locator("textarea");
    await promptTextarea.fill("");
    
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.initial_prompt).toBe("");
  });

  test("2. Extremely Long Prompt", async ({ settingsPage }) => {
    const promptTextarea = settingsPage.locator("textarea");
    const longPrompt = "A".repeat(5000);
    await promptTextarea.fill(longPrompt);
    
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.initial_prompt).toBe(longPrompt);
  });

  test("3. Prompt with Special Characters", async ({ settingsPage }) => {
    const promptTextarea = settingsPage.locator("textarea");
    const specialPrompt = "Graham & Son's. Code: <script>alert(1)</script> \ud83d\ude00 \n New line.";
    await promptTextarea.fill(specialPrompt);
    
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.initial_prompt).toBe(specialPrompt);
  });

  test("4. Server URL with Special Characters", async ({ settingsPage }) => {
    const backendSelect = settingsPage.locator("select").first();
    await backendSelect.selectOption("remote");
    
    const serverUrlInput = settingsPage.locator("input[placeholder*='transcribe']");
    const testUrl = "http://my-server.local:9000/api/v1/transcribe?auth=true#hash";
    await serverUrlInput.fill(testUrl);
    
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.server_url).toBe(testUrl);
  });

  test("5. Empty API Key Saving", async ({ settingsPage }) => {
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    const backendSelect = settingsPage.locator("select:has-text('LM Studio')");
    await backendSelect.selectOption("openai");

    const openaiKeyInput = settingsPage.locator("input[placeholder='sk-...']");
    await openaiKeyInput.fill("");

    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();

    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.openai_api_key).toBe("");
  });

  test("6. AI Model Empty Saving", async ({ settingsPage }) => {
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    const modelInput = settingsPage.locator("input[placeholder='llama3.2']");
    await modelInput.fill("");

    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();

    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.ai_model).toBe("");
  });

  test("7. LM Studio URL Empty Saving", async ({ settingsPage }) => {
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    // LM Studio is selected by default when AI is enabled
    const urlInput = settingsPage.locator("input[placeholder='http://localhost:1234']");
    await urlInput.fill("");

    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();

    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.ai_lmstudio_url).toBe("");
  });

  test("8. Ollama URL Empty Saving", async ({ settingsPage }) => {
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    const backendSelect = settingsPage.locator("select:has-text('LM Studio')");
    await backendSelect.selectOption("ollama");

    const urlInput = settingsPage.locator("input[placeholder='http://localhost:11434']");
    await urlInput.fill("");

    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();

    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.ai_ollama_url).toBe("");
  });

  test("9. Model Dropdown - Default Option Selected", async ({ settingsPage }) => {
    // Model selector is the second select when in local mode with default models
    const modelSelect = settingsPage.locator("select").nth(1);
    await expect(modelSelect).toHaveValue("");
  });

  test("10. Model Dropdown - Select Valid Model", async ({ settingsPage }) => {
    const modelSelect = settingsPage.locator("select").nth(1);
    await modelSelect.selectOption("C:\\models\\ggml-tiny.bin");

    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();

    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.whisper_model_path).toBe("C:\\models\\ggml-tiny.bin");
  });

  test("11. No Models Available - Displays Warning Message", async ({ settingsPage }) => {
    // Clear available models list in the mock and trigger reload via focus
    await settingsPage.evaluate(() => {
      (window as any).__MOCK_MODELS__ = [];
      (window as any).simulateTauriEvent("tauri://focus", true);
    });

    const warningText = settingsPage.locator("p:has-text('No models found')");
    await expect(warningText).toBeVisible();
    await expect(warningText).toHaveCSS("color", "rgb(220, 38, 38)"); // #dc2626
  });

  test("12. No Models Available - Add bin file note", async ({ settingsPage }) => {
    // Clear available models list in the mock and trigger reload via focus
    await settingsPage.evaluate(() => {
      (window as any).__MOCK_MODELS__ = [];
      (window as any).simulateTauriEvent("tauri://focus", true);
    });

    const warningText = settingsPage.locator("p:has-text('No models found')");
    await expect(warningText).toContainText("%LOCALAPPDATA%\\openfree\\models\\");
  });

  test("13. Audio Playback - Success State", async ({ settingsPage }) => {
    const playbackBtn = settingsPage.locator("button:has-text('Play Last Recording')");
    await playbackBtn.click();
    
    // Playback should succeed without displaying any error text
    const errorMsg = settingsPage.locator("span:has-text('disconnected')");
    await expect(errorMsg).not.toBeVisible();
  });

  test("14. Audio Playback - Error State", async ({ settingsPage }) => {
    // Inject error into mock playback command
    await settingsPage.evaluate(() => {
      (window as any).__PLAYBACK_ERROR__ = "Audio device disconnected";
    });

    const playbackBtn = settingsPage.locator("button:has-text('Play Last Recording')");
    await playbackBtn.click();

    const errorMsg = settingsPage.locator("span:has-text('Audio device disconnected')");
    await expect(errorMsg).toBeVisible();
  });

  test("15. Audio Playback - Clear Error on Re-click", async ({ settingsPage }) => {
    // Step 1: Inject error and click play
    await settingsPage.evaluate(() => {
      (window as any).__PLAYBACK_ERROR__ = "Playback error occurred";
    });
    const playbackBtn = settingsPage.locator("button:has-text('Play Last Recording')");
    await playbackBtn.click();
    const errorMsg = settingsPage.locator("span:has-text('Playback error occurred')");
    await expect(errorMsg).toBeVisible();

    // Step 2: Remove error and click play again
    await settingsPage.evaluate(() => {
      (window as any).__PLAYBACK_ERROR__ = null;
    });
    await playbackBtn.click();
    await expect(errorMsg).not.toBeVisible();
  });

  test("16. Pill Window - Idle State Hidden", async ({ pillPage }) => {
    // When state is idle, Pill component returns null (not rendered)
    const pill = pillPage.locator("#root > div > div");
    await expect(pill).toHaveCount(0);
  });

  test("17. Pill Window - Recording State Red", async ({ pillPage }) => {
    // Simulate dictation-state = recording
    await pillPage.evaluate(() => {
      (window as any).simulateTauriEvent("dictation-state", "recording");
    });
    
    const pill = pillPage.locator("#root > div > div");
    await expect(pill).toBeVisible();
    await expect(pill).toHaveCSS("background-color", "rgb(239, 68, 68)"); // #ef4444
  });

  test("18. Pill Window - Sending State Amber", async ({ pillPage }) => {
    await pillPage.evaluate(() => {
      (window as any).simulateTauriEvent("dictation-state", "sending");
    });
    
    const pill = pillPage.locator("#root > div > div");
    await expect(pill).toBeVisible();
    await expect(pill).toHaveCSS("background-color", "rgb(249, 115, 22)"); // #f97316
  });

  test("19. Pill Window - Error State Red", async ({ pillPage }) => {
    await pillPage.evaluate(() => {
      (window as any).simulateTauriEvent("dictation-state", "error");
    });
    
    const pill = pillPage.locator("#root > div > div");
    await expect(pill).toBeVisible();
    await expect(pill).toHaveCSS("background-color", "rgb(239, 68, 68)"); // #ef4444
  });

  test("20. Pill Window - Sequence Transition", async ({ pillPage }) => {
    const pill = pillPage.locator("#root > div > div");
    await expect(pill).toHaveCount(0); // Idle

    // Transition 1: Recording
    await pillPage.evaluate(() => {
      (window as any).simulateTauriEvent("dictation-state", "recording");
    });
    await expect(pill).toBeVisible();
    await expect(pill).toHaveCSS("background-color", "rgb(239, 68, 68)");

    // Transition 2: Sending
    await pillPage.evaluate(() => {
      (window as any).simulateTauriEvent("dictation-state", "sending");
    });
    await expect(pill).toBeVisible();
    await expect(pill).toHaveCSS("background-color", "rgb(249, 115, 22)");

    // Transition 3: Back to Idle
    await pillPage.evaluate(() => {
      (window as any).simulateTauriEvent("dictation-state", "idle");
    });
    await expect(pill).toHaveCount(0);
  });
});
