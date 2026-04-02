module.exports = ({ createReqRes, getIds }) => {
    test('Isolated auth module closes remaining forgot/reset/login branches', async () => {
      const ids = getIds();
      const originalNodeEnv = process.env.NODE_ENV;
      let authController;
      let UserMock;
      let CartMock;
      let ArtisanProfileMock;
      let NotificationMock;
      let getDbMock;
      let sendPasswordResetEmailMock;

      jest.isolateModules(() => {
        UserMock = {
          verifyPassword: jest.fn(),
          create: jest.fn(),
          findByEmail: jest.fn(),
          updatePassword: jest.fn()
        };
        CartMock = { mergeGuestCart: jest.fn() };
        ArtisanProfileMock = { findByUserId: jest.fn(), create: jest.fn() };
        NotificationMock = { create: jest.fn() };
        getDbMock = jest.fn(() => ({
          prepare: jest.fn(() => ({ run: jest.fn(), get: jest.fn(() => ({ id: 1, user_id: 1 })) }))
        }));
        sendPasswordResetEmailMock = jest.fn();

        jest.doMock('../../models/User', () => UserMock);
        jest.doMock('../../models/Cart', () => CartMock);
        jest.doMock('../../models/ArtisanProfile', () => ArtisanProfileMock);
        jest.doMock('../../models/Notification', () => NotificationMock);
        jest.doMock('../../config/database', () => ({ getDb: getDbMock }));
        jest.doMock('../../utils/email', () => ({ sendPasswordResetEmail: sendPasswordResetEmailMock }));

        authController = require('../../controllers/authController');
      });

      let pair = createReqRes({ body: {} });
      await authController.login(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/login');

      UserMock.verifyPassword.mockResolvedValue({
        id: ids.custId,
        email: 'customer@test.com',
        name: 'Customer',
        role: 'customer',
        status: 'active'
      });
      pair = createReqRes({ body: { email: 'customer@test.com', password: 'cust123' }, sessionID: null });
      await authController.login(pair.req, pair.res);
      expect(CartMock.mergeGuestCart).not.toHaveBeenCalled();
      expect(pair.res.redirect).toHaveBeenCalledWith('/');

      UserMock.create.mockResolvedValue({ id: ids.artId });
      pair = createReqRes({
        body: {
          name: 'Artisan',
          email: 'artisan@example.com',
          password: 'artisan123',
          confirm_password: 'artisan123',
          shop_name: 'Shop Name',
          bio: 'Bio',
          return_policy: ''
        },
        file: { filename: 'profile.png' }
      });
      await authController.registerArtisan(pair.req, pair.res);
      expect(ArtisanProfileMock.create).toHaveBeenCalledWith(expect.objectContaining({ profile_image: '/uploads/profile.png' }));

      pair = createReqRes();
      pair.req.session = {
        destroy: (cb) => cb(new Error('logout fail'))
      };
      authController.logout(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/');

      process.env.NODE_ENV = 'development';
      UserMock.findByEmail.mockReturnValue({ id: 1, email: 'user@test.com', name: 'User' });
      sendPasswordResetEmailMock.mockRejectedValue(new Error('mail fail'));
      pair = createReqRes({ body: { email: 'user@test.com' } });
      await authController.forgotPassword(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/forgot-password');

      process.env.NODE_ENV = 'production';
      pair = createReqRes({ body: { email: 'user@test.com' } });
      await authController.forgotPassword(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/forgot-password');

      sendPasswordResetEmailMock.mockResolvedValue({ success: true, messageId: 'x' });
      pair = createReqRes({ body: { email: 'user@test.com' } });
      await authController.forgotPassword(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/forgot-password');

      getDbMock.mockImplementationOnce(() => {
        throw new Error('db down');
      });
      pair = createReqRes({ body: { email: 'user@test.com' } });
      await authController.forgotPassword(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/forgot-password');

      UserMock.updatePassword.mockRejectedValue(new Error('update fail'));
      pair = createReqRes({
        params: { token: 'token-1' },
        body: { password: 'abcdef', confirm_password: 'abcdef' }
      });
      await authController.resetPassword(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/forgot-password');

      process.env.NODE_ENV = originalNodeEnv;
    });
};
