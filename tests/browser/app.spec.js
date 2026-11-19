import { test, expect } from "@playwright/test";

async function login(page) {
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Continue as Mia" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "My circle" }).first(),
  ).toBeVisible();
}
test("discovery, movie search, detail and seat selection use real data", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Casablanca", exact: true }).first(),
  ).toBeVisible();
  // The edge arrows switch films and wrap around; the ticket beside it follows.
  const current = page.locator(".feature-copy.current h1");
  await page.getByRole("button", { name: "Next film" }).click();
  await expect(current).toHaveText("Rear Window");
  await expect(page.locator(".admission-copy.current h2")).toHaveText(
    "Rear Window",
  );
  await page.getByRole("button", { name: "Previous film" }).click();
  await page.getByRole("button", { name: "Previous film" }).click();
  await expect(current).toHaveText("La La Land");
  await page.getByRole("button", { name: "Next film" }).click();
  await expect(current).toHaveText("Casablanca");
  await page.getByRole("link", { name: "Films", exact: true }).first().click();
  await page.getByRole("searchbox", { name: "Search films" }).fill("Spirited");
  await expect(
    page.getByRole("heading", { name: "Spirited Away", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".poster-card")).toHaveCount(1);
  await page
    .getByRole("link", { name: /Spirited Away/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Spirited Away", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Hayao Miyazaki", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Write a review", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("signed-in member creates, edits and deletes a review and a private list", async ({
  page,
}) => {
  await page.goto("/films/12");
  await login(page);
  await page
    .getByRole("button", { name: "Write a review", exact: true })
    .click();
  await page.getByLabel("Your rating").fill("0");
  await page
    .getByLabel("Your review", { exact: true })
    .fill("Browser test: a remarkable portrait.");
  await page
    .getByRole("button", { name: "Publish review", exact: true })
    .click();
  await expect(
    page.getByText("Browser test: a remarkable portrait."),
  ).toBeVisible();
  await expect(page.locator(".movie-rating > strong")).toHaveText("0.0");
  await page.getByRole("button", { name: "Edit review", exact: true }).click();
  await page
    .getByLabel("Your review", { exact: true })
    .fill("Browser test: an unforgettable portrait.");
  await page.getByRole("button", { name: "Save review", exact: true }).click();
  await expect(
    page.getByText("Browser test: an unforgettable portrait."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete review", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    page.getByText("Browser test: an unforgettable portrait."),
  ).toHaveCount(0);
  await page.goto("/circle");
  await page.getByRole("tab", { name: /^My lists/ }).click();
  await page
    .getByRole("button", { name: "Create a list", exact: true })
    .click();
  await page.getByLabel("List name").fill("Browser test list");
  await page.getByRole("button", { name: "Create list", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser test list", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add your first film" }).click();
  const picker = page.getByRole("dialog", { name: "Add films" });
  const search = picker.getByRole("searchbox", { name: "Search films" });
  await expect(search).toBeFocused();
  await search.fill("NoSuchFilm987");
  await expect(picker.getByText("No films found.")).toBeVisible();
  await search.fill("portrait");
  const film = picker
    .getByRole("listitem")
    .filter({ hasText: "Portrait of a Lady on Fire" });
  await expect(film.locator("img")).toBeVisible();
  await film
    .getByRole("button", {
      name: "Add Portrait of a Lady on Fire",
      exact: true,
    })
    .click();
  await expect(
    film.getByRole("button", { name: /already in this list/i }),
  ).toBeDisabled();
  await picker.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add films", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".list-film")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".list-film")).toHaveCount(1);
  await page.getByRole("button", { name: "Delete list", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(page).toHaveURL(/\/circle/);
});
test("booking confirms a server-priced ticket and persists it in history", async ({
  page,
  request,
}) => {
  await page.goto("/screenings/1");
  await login(page);
  await page.getByRole("button", { name: /^Seat B1, standard, HK\$/ }).click();
  await expect(page.getByTestId("booking-total")).toContainText("62.40");
  await page
    .getByRole("button", { name: "Confirm booking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "You’re going to the movies.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View my tickets", exact: true })
    .click();
  await expect(page.getByText("Seat B1", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Seat B1", { exact: true })).toBeVisible();
});
test("mobile pages fit viewport and dialogs support Escape", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/",
    "/films",
    "/films/1",
    "/cinemas",
    "/screenings/1",
    "/community",
  ]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/mobile-community.png",
    fullPage: true,
  });
});

test("community updates followed members immediately after signing in", async ({
  page,
}) => {
  await page.goto("/community");
  await login(page);
  await expect(
    page.getByRole("button", { name: "Unfollow alex", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Follow noah", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unfollow noah", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unfollow noah", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Unfollow noah", exact: true })
    .click();
});

test("an action started while signed out finishes after signing in", async ({
  page,
}) => {
  await page.goto("/members/3");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await page.getByRole("button", { name: "Continue as Mia" }).click();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Following", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Following", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Follow", exact: true }),
  ).toBeVisible();
});

test("screening filters stay in the address and empty days point to the next showing", async ({
  page,
}) => {
  await page.goto("/cinemas");
  const dates = page.getByRole("group", { name: "Choose screening date" });
  await dates.getByRole("button").nth(1).click();
  await page
    .getByRole("combobox", { name: "Filter screenings by film" })
    .click();
  await expect
    .poll(() =>
      page.getByRole("listbox").evaluate((el) => {
        const box = el.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight && box.height > 0;
      }),
    )
    .toBe(true);
  await page
    .getByRole("option", { name: "In the Mood for Love", exact: true })
    .click();
  await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}.*movieId=1/);
  const url = page.url();
  await page.reload();
  expect(page.url()).toBe(url);
  await expect(
    page.getByRole("combobox", { name: "Filter screenings by film" }),
  ).toContainText("In the Mood for Love");
  const empty = page.getByRole("heading", { name: /^Not showing on / });
  if (await empty.isVisible()) {
    await page.getByRole("button", { name: /^Go to / }).click();
    await expect(page.locator(".screening-row").first()).toBeVisible();
  }
  await page.locator(".time-option").first().click();
  await page.getByRole("link", { name: "All screenings" }).click();
  await expect(page).toHaveURL(/movieId=1/);
});

test("tabs follow the keyboard pattern and long feeds load more", async ({
  page,
}) => {
  await page.goto("/members/2");
  const reviews = page.getByRole("tab", { name: /^Reviews/ });
  await reviews.focus();
  await page.keyboard.press("ArrowRight");
  const lists = page.getByRole("tab", { name: /^Lists/ });
  await expect(lists).toBeFocused();
  await expect(lists).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute(
    "aria-labelledby",
    await lists.getAttribute("id"),
  );
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: /^Watched/ })).toBeFocused();
  await page.goto("/community");
  const cards = page.locator(".community-layout .review-card");
  const before = await cards.count();
  const more = page.getByRole("button", { name: "Show more reviews" });
  await more.click();
  await expect(cards).not.toHaveCount(before);
  // Keep loading until every review is shown and the button goes away.
  for (let i = 0; i < 5 && (await more.count()); i++) {
    const shown = await cards.count();
    await more.click();
    await expect(cards).not.toHaveCount(shown);
  }
  await expect(more).toHaveCount(0);
});

test("members hold a conversation under a review and find tickets in their circle", async ({
  page,
}) => {
  await page.goto("/community");
  await login(page);
  const card = page.locator(".community-layout .review-card").first();
  await card.getByRole("button", { name: /Comment|comments?$/ }).click();
  const box = card.getByRole("textbox", { name: "Your comment" });
  await box.fill("Seeing it again this weekend.");
  await card.getByRole("button", { name: "Post", exact: true }).click();
  await expect(card.getByText("Seeing it again this weekend.")).toBeVisible();
  // Reply to it: the comment becomes the focus, with its replies beneath and a way back.
  await card
    .locator(".thread-comment", { hasText: "Seeing it again this weekend." })
    .getByRole("button", { name: /^Reply to Mia/ })
    .click();
  const reply = card.getByRole("textbox", { name: "Reply to Mia" });
  await expect(reply).toBeFocused();
  await reply.fill("Saturday, 21:00.");
  await card.getByRole("button", { name: "Post", exact: true }).click();
  await expect(card.locator(".thread-main")).toContainText(
    "Seeing it again this weekend.",
  );
  await expect(
    card.locator(".thread-list").getByText("Saturday, 21:00."),
  ).toBeVisible();
  await card.getByRole("button", { name: "Back to the review" }).click();
  const mine = card.locator(".thread-comment", {
    hasText: "Seeing it again this weekend.",
  });
  await expect(
    mine.getByRole("button", { name: /^Open 1 reply/ }),
  ).toBeVisible();
  await mine.getByRole("button", { name: /^Remove comment by Mia/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(card.getByText("Seeing it again this weekend.")).toHaveCount(0);
  // Bookmarked collections wait under Saved; a collection's page saves or unsaves it.
  await page.goto("/circle?tab=saved");
  await page.getByRole("link", { name: /Golden age Hollywood/ }).click();
  const save = page.getByRole("button", { name: "Saved" });
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await save.click();
  await expect(page.getByRole("button", { name: "Bookmark" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "Bookmark" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.goto("/circle?tab=tickets");
  await expect(page.getByRole("tab", { name: /^Tickets/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Your next nights out." }),
  ).toBeVisible();
});

test("the bell gathers activity and the feed can follow only chosen members", async ({
  page,
}) => {
  await page.goto("/community");
  await login(page);
  const bell = page.getByRole("button", { name: /^Notifications/ });
  await expect(bell).toHaveAttribute("aria-label", /Notifications, \d+ new/);
  await bell.click();
  const panel = page.getByRole("region", { name: "Notifications" });
  await expect(panel.getByText(/started following you/).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(bell).toHaveAttribute("aria-label", "Notifications");
  await expect(bell).toBeFocused();
  await page.getByRole("button", { name: "People you follow" }).click();
  const authors = page.locator(".community-layout .review-card .member-inline");
  // Wait for the feed to switch, then check every author is someone Mia follows.
  await expect
    .poll(async () =>
      (await authors.allTextContents()).every((name) =>
        ["Alex", "Eleanor"].includes(name.trim().slice(1)),
      ),
    )
    .toBe(true);
});

test("a notification link opens the conversation at the reply, also while the film page is open", async ({
  page,
}) => {
  const api = async (path) => (await page.request.get(path)).json();
  const review = (await api("/api/reviews?userId=2&movieId=11")).reviews[0];
  const top = (
    await api(`/api/reviews/${review.reviewId}/comments`)
  ).comments.find((c) => c.username === "noah");
  const reply = (
    await api(
      `/api/reviews/${review.reviewId}/comments?parent=${top.commentId}`,
    )
  ).comments[0];
  await page.goto(
    `/films/11?thread=${review.reviewId}&comment=${reply.commentId}`,
  );
  const thread = page.locator(".review-thread");
  await expect(thread.locator(".thread-main")).toContainText("Same here.");
  await expect(thread.locator(".thread-list")).toContainText(
    "hands on the glass",
  );
  await expect(
    thread.getByRole("button", { name: "Back to Noah's comment" }),
  ).toBeVisible();
  // Already on the page, with the conversation closed: a new link still opens it.
  await page.goto("/films/11");
  await expect(page.locator(".review-thread")).toHaveCount(0);
  await page.evaluate(
    (to) =>
      document
        .querySelector("#app")
        .__vue_app__.config.globalProperties.$router.push(to),
    `/films/11?thread=${review.reviewId}&comment=${top.commentId}`,
  );
  await expect(page.locator(".review-thread .thread-main")).toContainText(
    "The ending got me too.",
  );
});

test("signed-out actions ask to sign in, then finish: review likes, replies and My circle", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Liking a review.
  await page.goto("/films/11");
  await page.getByRole("button", { name: "Like review by alex" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Continue as Mia" }).click();
  await expect(
    page.getByRole("button", { name: "Unlike review by alex" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Unlike review by alex" }).click();
  await page.getByRole("link", { name: "My circle" }).first().click();
  await page.getByRole("button", { name: "Sign out" }).click();
  // Replying to a comment.
  await page.goto("/films/11");
  const card = page.locator(".review-card", { hasText: "Science fiction" });
  await card.getByRole("button", { name: /comments?$/ }).click();
  await card.getByRole("button", { name: "Reply to Mia" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Continue as Mia" }).click();
  await expect(
    card.getByRole("textbox", { name: "Reply to Mia" }),
  ).toBeFocused();
  await expect(card.locator(".thread-main")).toContainText("Agreed.");
  await page.getByRole("link", { name: "My circle" }).first().click();
  await page.getByRole("button", { name: "Sign out" }).click();
  // Opening My circle.
  await page.goto("/circle");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Continue as Mia" }).click();
  await expect(
    page.getByRole("heading", { name: "Mia’s corner." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("following the same notification again reopens a conversation closed since", async ({
  page,
}) => {
  await page.goto("/");
  await login(page);
  const bell = page.getByRole("button", { name: /^Notifications/ });
  const follow = async () => {
    await bell.click();
    await page
      .getByRole("region", { name: "Notifications" })
      .getByRole("link", {
        name: /Alex commented on your review of La La Land/,
      })
      .click();
  };
  await follow();
  const card = page.locator(".review-card", { hasText: "Some dreams" });
  await expect(card.locator(".review-thread")).toBeVisible();
  await card.getByRole("button", { name: /comments?$/ }).click();
  await expect(card.locator(".review-thread")).toHaveCount(0);
  await follow();
  await expect(card.locator(".review-thread")).toBeVisible();
});

test("a film page can start a new list with that film", async ({ page }) => {
  await page.goto("/films/11");
  await login(page);
  await page.getByRole("button", { name: "Add to a list" }).click();
  const dialog = page.getByRole("dialog");
  const listMenu = dialog.getByRole("combobox", { name: "Your list" });
  await listMenu.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(listMenu).toBeFocused();
  await dialog.getByRole("button", { name: "New list" }).click();
  await dialog.getByText("Everyone", { exact: true }).click();
  await expect(
    dialog.getByRole("radio", { name: "Public", exact: true }),
  ).toBeChecked();
  await dialog.getByText("Only me", { exact: true }).click();
  await dialog
    .getByRole("textbox", { name: "List name" })
    .fill("Quiet arrivals");
  await dialog.getByRole("button", { name: "Create list and add" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Arrival is the first film in Quiet arrivals."),
  ).toBeVisible();
  await page.goto("/circle?tab=lists");
  await page.getByRole("link", { name: /Quiet arrivals/ }).click();
  await expect(
    page.getByRole("heading", { name: "Quiet arrivals" }),
  ).toBeVisible();
  await expect(page.getByText("1 film", { exact: true })).toBeVisible();
  page.once("dialog", () => {});
  await page.getByRole("button", { name: "Delete list" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
});
