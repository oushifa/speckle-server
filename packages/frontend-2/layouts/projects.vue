<template>
  <div>
    <HeaderNavBar />
    <div class="h-dvh w-dvh overflow-hidden flex flex-col">
      <!-- Static Spacer to allow for absolutely positioned HeaderNavBar  -->
      <div class="h-12 w-full shrink-0"></div>

      <div class="relative flex h-[calc(100dvh-3rem)]">
        <ProjectsSidebar />

        <div class="size-full bg-[#2c3e50]">
          <div
            style="border-top-left-radius: 30px"
            class="size-full bg-white overflow-hidden"
          >
            <main class="w-full h-full overflow-y-auto simple-scrollbar py-6 lg:py-8">
              <div class="container mx-auto px-6 md:px-8">
                <div class="breadcrumbs flex text-sm font-medium text-slate-600">
                  <NuxtLink to="/projects">项目管理</NuxtLink>
                  <ClientOnly>
                    <PortalTarget name="current-page"></PortalTarget>
                    <PortalTarget name="current-project"></PortalTarget>
                  </ClientOnly>
                </div>
                <div>
                  <slot />
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.breadcrumbs > :not(:first-child)::before {
  content: '/';
  margin: 0 0.5rem;
}
</style>
