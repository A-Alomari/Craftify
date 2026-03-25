import { wireFaqPage, wireContactPage } from "./supportPages.js";
import { wireOrderConfirmationPage, wireOrderTrackingPage, wireOrderHistoryPage } from "./orderPages.js";
import { wireNotificationCenterPage, wireUserProfileSettingsPage } from "./userPages.js";
import { wireArtisanRegistrationSteps } from "./sellerRegistrationPages.js";
import { wireArtisanDashboardPage, wireArtisanManageOrdersPage, wireArtisanSalesAnalyticsPage } from "./sellerDashboardPages.js";
import { wireAdminPanelPage } from "./adminPages.js";
import { wireAdminReportsPage } from "./adminReportsPages.js";
import { wireAddProductPage, wireEditProductPage } from "./sellerProductPages.js";
import { wireLiveAuctions, wireAuctionDetail, wireAuctionWonPaymentPage, wireCreateAuctionPage } from "./auctionPages.js";
import { wireMessagingChatPage } from "./messagingPages.js";
import { wireReviewSubmissionPage } from "./reviewPages.js";
import { wireNotificationNav, wireGlobalNavigationAndFooter } from "./navigationPages.js";
import {
  refreshCartBadge,
  wireProductBrowsing,
  wireProductDetail,
  wireCartPage,
  wireCheckoutPage,
  wireWishlistPage,
  wireSearchResultsPage,
  wireHomePage,
  wireArtisanProfilePage,
} from "./commercePages.js";

export function initShopPages() {
  wireNotificationNav();
  wireGlobalNavigationAndFooter();
  refreshCartBadge();

  const path = window.location.pathname;
  if (path.includes("/products/product-browsing.html")) {
    wireProductBrowsing();
  } else if (path.includes("/products/product-detail.html")) {
    wireProductDetail();
  } else if (path.includes("/auctions/live-auctions.html")) {
    wireLiveAuctions();
  } else if (path.includes("/auctions/auction-detail.html")) {
    wireAuctionDetail();
  } else if (path.includes("/auctions/auction-won-payment.html")) {
    wireAuctionWonPaymentPage();
  } else if (path.includes("/shopping/shopping-cart.html")) {
    wireCartPage();
  } else if (path.includes("/shopping/checkout.html")) {
    wireCheckoutPage();
  } else if (path.includes("/shopping/order-confirmation.html")) {
    wireOrderConfirmationPage();
  } else if (path.includes("/orders/order-tracking.html")) {
    wireOrderTrackingPage();
  } else if (path.includes("/orders/order-history.html")) {
    wireOrderHistoryPage();
  } else if (path.includes("/user/my-wishlist.html")) {
    wireWishlistPage();
  } else if (path.includes("/user/messaging-chat.html")) {
    wireMessagingChatPage();
  } else if (path.includes("/products/search-results.html")) {
    wireSearchResultsPage();
  } else if (path.includes("/user/notification-center.html")) {
    wireNotificationCenterPage();
  } else if (path.includes("/user/profile-settings.html")) {
    wireUserProfileSettingsPage();
  } else if (path.includes("/seller/artisan-registration-step-1.html") || path.includes("/seller/artisan-registration-step-2.html") || path.includes("/seller/artisan-registration-step-3.html")) {
    wireArtisanRegistrationSteps();
  } else if (path.includes("/products/add-product.html")) {
    wireAddProductPage();
  } else if (path.includes("/products/edit-product.html")) {
    wireEditProductPage();
  } else if (path.includes("/seller/artisan-dashboard.html")) {
    wireArtisanDashboardPage();
  } else if (path.includes("/seller/manage-orders.html")) {
    wireArtisanManageOrdersPage();
  } else if (path.includes("/seller/sales-analytics.html")) {
    wireArtisanSalesAnalyticsPage();
  } else if (path.includes("/admin/admin-panel.html")) {
    wireAdminPanelPage();
  } else if (path.includes("/admin/reports.html")) {
    wireAdminReportsPage();
  } else if (path.includes("/help/faq.html")) {
    wireFaqPage();
  } else if (path.includes("/help/contact-us.html")) {
    wireContactPage();
  } else if (path.includes("/home/index.html")) {
    wireHomePage();
  } else if (path.includes("/auctions/create-auction.html")) {
    wireCreateAuctionPage();
  } else if (path.includes("/user/artisan-profile.html")) {
    wireArtisanProfilePage();
  } else if (path.includes("/user/write-review.html")) {
    wireReviewSubmissionPage();
  }
}

