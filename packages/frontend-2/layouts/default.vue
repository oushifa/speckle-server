<template>
  <div>
    <HeaderNavBar />
    <div class="h-dvh w-dvh overflow-hidden flex flex-col">
      <!-- Static Spacer to allow for absolutely positioned HeaderNavBar  -->
      <div class="h-12 w-full shrink-0"></div>

      <div class="relative flex h-[calc(100dvh-3rem)]">
        <DashboardSidebar />
        <div class="size-full bg-[rgb(26,40,70)]">
          <div
            style="border-top-left-radius: 30px"
            class="size-full bg-white overflow-hidden"
          >
            <main class="h-full w-full overflow-y-auto simple-scrollbar">
              <div class="min-h-full w-full p-[25px]">
                <slot />
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
